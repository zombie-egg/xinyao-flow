import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { startOfChinaDay } from "@/lib/utils";
import { z } from "zod";
const schema = z.object({ action: z.enum(["CHECK_IN", "CHECK_OUT"]) });
export async function POST(req: Request) {
  try {
    const admin = await requireUser();
    if (admin.role.code !== "ADMIN")
      return fail("只有管理员可以发布签到签退任务", "FORBIDDEN", 403);
    const p = schema.safeParse(await req.json());
    if (!p.success) return fail("发布类型无效", "VALIDATION_ERROR");
    const setting = await db.companySetting.findUnique({
      where: { id: "company" },
    });
    if (!setting)
      return fail("考勤设置不存在", "ATTENDANCE_NOT_CONFIGURED", 409);
    const date = startOfChinaDay(),
      now = new Date(),
      checkIn = p.data.action === "CHECK_IN",
      requirement = await db.$transaction(async (tx) => {
        const existing = await tx.dailyAttendanceRequirement.findUnique({
          where: { date },
        });
        if (checkIn && existing?.checkInPublishedAt)
          throw new Error("ALREADY_PUBLISHED");
        if (!checkIn && existing?.checkOutPublishedAt)
          throw new Error("ALREADY_PUBLISHED");
        const item = await tx.dailyAttendanceRequirement.upsert({
            where: { date },
            update: checkIn
              ? {
                  requireCheckIn: true,
                  checkInPublishedAt: now,
                  checkInDurationMinutes: setting.attendanceWindowMinutes,
                  publishedById: admin.id,
                }
              : {
                  requireCheckOut: true,
                  checkOutPublishedAt: now,
                  checkOutDurationMinutes: setting.attendanceWindowMinutes,
                  publishedById: admin.id,
                },
            create: {
              date,
              requireCheckIn: checkIn,
              requireCheckOut: !checkIn,
              checkInPublishedAt: checkIn ? now : null,
              checkOutPublishedAt: checkIn ? null : now,
              checkInDurationMinutes: setting.attendanceWindowMinutes,
              checkOutDurationMinutes: setting.attendanceWindowMinutes,
              publishedById: admin.id,
            },
          }),
          employees = await tx.user.findMany({
            where: { status: "ACTIVE", departmentId: { not: null } },
            select: { id: true },
          });
        if (employees.length)
          await tx.notification.createMany({
            data: employees.map((employee) => ({
              userId: employee.id,
              type: "SYSTEM" as const,
              title: checkIn ? "今日需要签到" : "今日需要签退",
              content: checkIn
                ? `管理员已发布签到任务，请在 ${setting.attendanceWindowMinutes} 分钟内完成`
                : `管理员已发布签退任务，请在 ${setting.attendanceWindowMinutes} 分钟内完成`,
              targetId: item.id,
            })),
          });
        await tx.operationLog.create({
          data: {
            userId: admin.id,
            action: checkIn ? "PUBLISH_CHECK_IN" : "PUBLISH_CHECK_OUT",
            module: "ATTENDANCE",
            targetId: item.id,
            description: `${checkIn ? "发布今日签到" : "发布今日签退"}，有效 ${setting.attendanceWindowMinutes} 分钟`,
          },
        });
        return item;
      });
    return ok(requirement);
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_PUBLISHED")
      return fail(
        "今日该考勤任务已经发布，不能重复发布",
        "ALREADY_PUBLISHED",
        409,
      );
    return apiError(e);
  }
}
