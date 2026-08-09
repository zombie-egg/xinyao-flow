import { db } from "@/lib/db";
import { ok, fail, apiError } from "@/lib/api";
import { startOfChinaDay } from "@/lib/utils";
import {
  attendanceDirectAdmin,
  attendanceResult,
  publishedAttendanceDeadline,
} from "@/lib/attendance";
export async function POST(req: Request) {
  try {
    if (
      !process.env.CRON_SECRET ||
      req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
    )
      return fail("无权执行", "FORBIDDEN", 403);
    const date = startOfChinaDay(),
      next = new Date(date.getTime() + 86400000),
      now = new Date(),
      [users, setting, requirement] = await Promise.all([
        db.user.findMany({
          where: { status: "ACTIVE", departmentId: { not: null } },
          include: { role: true, department: true },
        }),
        db.companySetting.findUnique({ where: { id: "company" } }),
        db.dailyAttendanceRequirement.findUnique({ where: { date } }),
      ]);
    if (!setting) return fail("考勤设置不存在", "ATTENDANCE_NOT_CONFIGURED");
    const checkInEnd = requirement?.checkInPublishedAt
        ? publishedAttendanceDeadline(
            requirement.checkInPublishedAt,
            requirement.checkInDurationMinutes,
          )
        : null,
      checkOutEnd = requirement?.checkOutPublishedAt
        ? publishedAttendanceDeadline(
            requirement.checkOutPublishedAt,
            requirement.checkOutDurationMinutes,
          )
        : null,
      afterCheckInWindow = Boolean(checkInEnd && now >= checkInEnd),
      afterCheckOutWindow = Boolean(checkOutEnd && now >= checkOutEnd),
      explanationDeadline = new Date(now.getTime() - 24 * 60 * 60 * 1000),
      unexplained = await db.attendanceException.findMany({
        where: {
          status: { in: ["PENDING_MANAGER", "PENDING_ADMIN"] },
          reason: null,
          updatedAt: { lte: explanationDeadline },
        },
        include: { attendance: { include: { user: true } } },
      });
    let autoArchived = 0;
    for (const exception of unexplained) {
      const archived = await db.$transaction(async (tx) => {
        const result = await tx.attendanceException.updateMany({
          where: {
            id: exception.id,
            status: { in: ["PENDING_MANAGER", "PENDING_ADMIN"] },
            reason: null,
          },
          data: { status: "APPROVED", disposition: "ARCHIVED" },
        });
        if (!result.count) return false;
        await tx.attendance.update({
          where: { id: exception.attendanceId },
          data: { excludedFromStats: false },
        });
        await tx.notification.create({
          data: {
            userId: exception.attendance.userId,
            type: "SYSTEM",
            title: "考勤异常已自动归档",
            content:
              "考勤异常产生后 24 小时内未填写原因，系统已自动归档并计入统计。",
            targetId: exception.id,
          },
        });
        await tx.operationLog.create({
          data: {
            action: "AUTO_ARCHIVE_ATTENDANCE",
            module: "ATTENDANCE",
            targetId: exception.id,
            description: `系统自动归档 ${exception.attendance.user.name} 的未说明考勤异常`,
          },
        });
        return true;
      });
      if (archived) autoArchived++;
    }
    let processed = 0;
    for (const user of users) {
      const [attendance, leave] = await Promise.all([
        db.attendance.findUnique({
          where: { userId_date: { userId: user.id, date } },
          include: { exception: true },
        }),
        db.leaveRequest.findFirst({
          where: {
            userId: user.id,
            status: "APPROVED",
            startDate: { lt: next },
            endDate: { gte: date },
          },
        }),
      ]);
      await db.$transaction(async (tx) => {
        if (leave) {
          const item = await tx.attendance.upsert({
            where: { userId_date: { userId: user.id, date } },
            update: {
              checkInTime: null,
              checkOutTime: null,
              isLate: false,
              isEarlyLeave: false,
              excludedFromStats: true,
              status: "LEAVE",
              remark: "已批准请假",
            },
            create: {
              userId: user.id,
              date,
              status: "LEAVE",
              excludedFromStats: true,
              remark: "已批准请假",
            },
          });
          await tx.attendanceException.updateMany({
            where: { attendanceId: item.id },
            data: { status: "APPROVED", disposition: "EXEMPT" },
          });
          return;
        }
        const missingCheckIn = Boolean(
            requirement?.requireCheckIn &&
              afterCheckInWindow &&
              !attendance?.checkInTime,
          ),
          missingCheckOut = Boolean(
            requirement?.requireCheckOut &&
              afterCheckOutWindow &&
              !attendance?.checkOutTime,
          ),
          newLate = missingCheckIn && !attendance?.isLate,
          newEarly = missingCheckOut && !attendance?.isEarlyLeave;
        if (!missingCheckIn && !missingCheckOut) {
          const activePublishedTask = Boolean(
            (requirement?.requireCheckIn &&
              !attendance?.checkInTime &&
              !afterCheckInWindow) ||
              (requirement?.requireCheckOut &&
                !attendance?.checkOutTime &&
                !afterCheckOutWindow),
          );
          if (!attendance && !activePublishedTask)
            await tx.attendance.create({
              data: {
                userId: user.id,
                date,
                status: "ON_TIME",
                excludedFromStats: false,
                remark: "管理员未要求的项目默认出勤",
              },
            });
          return;
        }
        if (attendance?.exception && !newLate && !newEarly) return;
        const isLate = Boolean(attendance?.isLate || missingCheckIn),
          isEarlyLeave = Boolean(attendance?.isEarlyLeave || missingCheckOut),
          { status, exceptionType } = attendanceResult(isLate, isEarlyLeave),
          item = await tx.attendance.upsert({
            where: { userId_date: { userId: user.id, date } },
            update: {
              isLate,
              isEarlyLeave,
              status,
              excludedFromStats: true,
              remark: [
                missingCheckIn ? "未完成管理员发布的签到任务" : "",
                missingCheckOut ? "未完成管理员发布的签退任务" : "",
              ]
                .filter(Boolean)
                .join("；"),
            },
            create: {
              userId: user.id,
              date,
              isLate,
              isEarlyLeave,
              status,
              excludedFromStats: true,
              remark: [
                missingCheckIn ? "未完成管理员发布的签到任务" : "",
                missingCheckOut ? "未完成管理员发布的签退任务" : "",
              ]
                .filter(Boolean)
                .join("；"),
            },
          });
        if (exceptionType)
          await tx.attendanceException.upsert({
            where: { attendanceId: item.id },
            update: {
              type: exceptionType,
              status: attendanceDirectAdmin(
                user.role.code,
                user.department?.code,
              )
                ? "PENDING_ADMIN"
                : "PENDING_MANAGER",
              disposition: "PENDING",
            },
            create: {
              attendanceId: item.id,
              type: exceptionType,
              status: attendanceDirectAdmin(
                user.role.code,
                user.department?.code,
              )
                ? "PENDING_ADMIN"
                : "PENDING_MANAGER",
              disposition: "PENDING",
            },
          });
        await tx.operationLog.create({
          data: {
            action: "CLOSE_ATTENDANCE_REQUIREMENT",
            module: "ATTENDANCE",
            targetId: item.id,
            description: `系统结算 ${user.name}：${exceptionType}`,
          },
        });
      });
      processed++;
    }
    return ok({
      processed,
      requireCheckIn: Boolean(requirement?.requireCheckIn),
      requireCheckOut: Boolean(requirement?.requireCheckOut),
      autoArchived,
    });
  } catch (e) {
    return apiError(e);
  }
}
