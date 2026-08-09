import { locationSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { haversineMeters, startOfChinaDay } from "@/lib/utils";
import { publishedAttendanceDeadline } from "@/lib/attendance";
export async function POST(req: Request) {
  try {
    const user = await requirePermission("attendance:self"),
      parsed = locationSchema.safeParse(await req.json());
    if (!parsed.success) return fail("定位数据无效", "INVALID_LOCATION");
    const date = startOfChinaDay(),
      next = new Date(date.getTime() + 86400000),
      [setting, requirement, approvedLeave] = await Promise.all([
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
      ]);
    if (!requirement?.requireCheckIn)
      return fail(
        "管理员今日未发布签到任务，默认正常出勤",
        "CHECK_IN_NOT_REQUIRED",
        409,
      );
    if (approvedLeave)
      return fail("今日已批准请假，无需签到", "APPROVED_LEAVE", 409);
    if (setting?.latitude == null || setting.longitude == null)
      return fail("管理员尚未配置考勤地点", "ATTENDANCE_NOT_CONFIGURED");
    const distance = haversineMeters(parsed.data, {
      latitude: setting.latitude,
      longitude: setting.longitude,
    });
    if (distance > setting.attendanceRadius)
      return fail(
        `当前距离公司 ${Math.round(distance)} 米，超出 ${setting.attendanceRadius} 米签到范围`,
        "OUT_OF_RANGE",
      );
    if (!requirement.checkInPublishedAt)
      return fail("签到任务发布时间无效", "INVALID_REQUIREMENT", 409);
    const now = new Date(),
      checkInEnd = publishedAttendanceDeadline(
        requirement.checkInPublishedAt,
        requirement.checkInDurationMinutes,
      );
    if (now > checkInEnd)
      return fail(
        "签到时间已结束：未签到。系统将记录为迟到，请在异常记录中说明原因",
        "CHECK_IN_WINDOW_CLOSED",
        409,
      );
    const status = "ON_TIME" as const;
    const record = await db.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: { userId_date: { userId: user.id, date } },
      });
      if (existing?.checkInTime) throw new Error("ALREADY_CHECKED_IN");
      const attendance = await tx.attendance.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: {
          checkInTime: now,
          checkInLatitude: parsed.data.latitude,
          checkInLongitude: parsed.data.longitude,
          checkInAccuracy: parsed.data.accuracy,
          distanceMeters: distance,
          status,
          isLate: false,
          excludedFromStats: false,
          remark: null,
        },
        create: {
          userId: user.id,
          date,
          checkInTime: now,
          checkInLatitude: parsed.data.latitude,
          checkInLongitude: parsed.data.longitude,
          checkInAccuracy: parsed.data.accuracy,
          distanceMeters: distance,
          status,
          isLate: false,
          excludedFromStats: false,
        },
      });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "CHECK_IN",
          module: "ATTENDANCE",
          targetId: attendance.id,
          description: `按时签到，距离 ${Math.round(distance)} 米`,
        },
      });
      return attendance;
    });
    return ok({ ...record, distanceMeters: Math.round(distance) });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CHECKED_IN")
      return fail("今天已经签到", "ALREADY_CHECKED_IN", 409);
    return apiError(e);
  }
}
