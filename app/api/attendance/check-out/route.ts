import { locationSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { haversineMeters, startOfChinaDay } from "@/lib/utils";
import {
  attendanceDirectAdmin,
  attendanceResult,
  publishedAttendanceDeadline,
} from "@/lib/attendance";
export async function POST(req: Request) {
  try {
    const user = await requirePermission("attendance:self"),
      p = locationSchema.safeParse(await req.json());
    if (!p.success) return fail("定位数据无效", "INVALID_LOCATION");
    const date = startOfChinaDay(),
      next = new Date(date.getTime() + 86400000),
      [setting, requirement, approvedLeave, record] = await Promise.all([
        db.companySetting.findUnique({ where: { id: "company" } }),
        db.dailyAttendanceRequirement.findUnique({ where: { date } }),
        db.leaveRequest.findFirst({
          where: {
            userId: user.id,
            status: "APPROVED",
            startDate: { lt: next },
            endDate: { gte: date },
          },
        }),
        db.attendance.findUnique({
          where: { userId_date: { userId: user.id, date } },
        }),
      ]);
    if (!requirement?.requireCheckOut)
      return fail(
        "管理员今日未发布签退任务，默认正常出勤",
        "CHECK_OUT_NOT_REQUIRED",
        409,
      );
    if (approvedLeave)
      return fail("今日已批准请假，无需签退", "APPROVED_LEAVE", 409);
    if (record?.checkOutTime)
      return fail("今天已经签退", "ALREADY_CHECKED_OUT", 409);
    if (setting?.latitude == null || setting.longitude == null)
      return fail("管理员尚未配置考勤地点", "ATTENDANCE_NOT_CONFIGURED");
    const distance = haversineMeters(p.data, {
      latitude: setting.latitude,
      longitude: setting.longitude,
    });
    if (distance > setting.attendanceRadius)
      return fail(
        `当前距离公司 ${Math.round(distance)} 米，超出签退范围`,
        "OUT_OF_RANGE",
      );
    if (!requirement.checkOutPublishedAt)
      return fail("签退任务发布时间无效", "INVALID_REQUIREMENT", 409);
    const now = new Date(),
      checkOutEnd = publishedAttendanceDeadline(
        requirement.checkOutPublishedAt,
        requirement.checkOutDurationMinutes,
      );
    if (now > checkOutEnd)
      return fail(
        "签退时间已结束：未签退。系统将记录为早退，请在异常记录中说明原因",
        "CHECK_OUT_WINDOW_CLOSED",
        409,
      );
    const isLate =
        Boolean(requirement.requireCheckIn && !record?.checkInTime) ||
        Boolean(record?.isLate),
      isEarlyLeave = false,
      { status, exceptionType } = attendanceResult(isLate, isEarlyLeave),
      directAdmin = attendanceDirectAdmin(
        user.role.code,
        user.department?.code,
      );
    const result = await db.$transaction(async (tx) => {
      const item = await tx.attendance.upsert({
          where: { userId_date: { userId: user.id, date } },
          update: {
            checkOutTime: now,
            checkOutLatitude: p.data.latitude,
            checkOutLongitude: p.data.longitude,
            checkOutAccuracy: p.data.accuracy,
            isLate,
            isEarlyLeave,
            status,
            excludedFromStats: Boolean(exceptionType),
          },
          create: {
            userId: user.id,
            date,
            checkOutTime: now,
            checkOutLatitude: p.data.latitude,
            checkOutLongitude: p.data.longitude,
            checkOutAccuracy: p.data.accuracy,
            isLate,
            isEarlyLeave,
            status,
            excludedFromStats: Boolean(exceptionType),
          },
        }),
        existingException = await tx.attendanceException.findUnique({
          where: { attendanceId: item.id },
        });
      if (exceptionType && !existingException)
        await tx.attendanceException.create({
          data: {
            attendanceId: item.id,
            type: exceptionType,
            status: directAdmin ? "PENDING_ADMIN" : "PENDING_MANAGER",
            disposition: "PENDING",
          },
        });
      else if (
        exceptionType &&
        existingException &&
        existingException.type !== exceptionType
      )
        await tx.attendanceException.update({
          where: { id: existingException.id },
          data: {
            type: exceptionType,
            status: directAdmin ? "PENDING_ADMIN" : "PENDING_MANAGER",
            disposition: "PENDING",
          },
        });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "CHECK_OUT",
          module: "ATTENDANCE",
          targetId: item.id,
          description: `签退${isEarlyLeave ? "（早退）" : ""}，距离 ${Math.round(distance)} 米`,
        },
      });
      return item;
    });
    return ok(result);
  } catch (e) {
    return apiError(e);
  }
}
