import { db } from "@/lib/db";
import { requireUser, isManager } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";
const schema = z.object({
  action: z.enum(["ARCHIVE", "EXEMPT"]),
  comment: z.string().trim().max(1000).optional(),
});
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await requireUser(),
      { id } = await params,
      p = schema.safeParse(await req.json());
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const item = await db.attendanceException.findUnique({
      where: { id },
      include: { attendance: { include: { user: true } } },
    });
    if (!item) return fail("异常记录不存在", "NOT_FOUND", 404);
    if (!item.reason?.trim())
      return fail(
        "员工尚未填写原因，请等待员工说明；超过 24 小时未说明将自动归档",
        "REASON_REQUIRED",
        409,
      );
    const managerStage = item.status === "PENDING_MANAGER";
    if (
      managerStage &&
      (!isManager(u.role.code) ||
        u.departmentId !== item.attendance.user.departmentId)
    )
      throw new Error("FORBIDDEN");
    if (
      !managerStage &&
      (item.status !== "PENDING_ADMIN" || u.role.code !== "ADMIN")
    )
      throw new Error("FORBIDDEN");
    const updated = await db.$transaction(async (tx) => {
      const fresh = await tx.attendanceException.findUniqueOrThrow({
        where: { id },
      });
      if (fresh.status !== item.status || fresh.disposition !== "PENDING")
        throw new Error("ALREADY_PROCESSED");
      const exempt = p.data.action === "EXEMPT",
        finalArchive = p.data.action === "ARCHIVE" && !managerStage,
        nextStatus = exempt || finalArchive ? "APPROVED" : "PENDING_ADMIN",
        disposition = exempt
          ? ("EXEMPT" as const)
          : finalArchive
            ? ("ARCHIVED" as const)
            : ("PENDING" as const),
        x = await tx.attendanceException.update({
          where: { id },
          data: { status: nextStatus, disposition },
        });
      await tx.attendance.update({
        where: { id: item.attendanceId },
        data: { excludedFromStats: !finalArchive },
      });
      await tx.leaveApproval.create({
        data: {
          attendanceExceptionId: id,
          approverId: u.id,
          approverRole: u.role.code,
          result: exempt ? "免除" : "归档",
          comment: p.data.comment,
        },
      });
      await tx.notification.create({
        data: {
          userId: item.attendance.userId,
          type: "APPROVAL",
          title: "考勤处理状态更新",
          content: exempt
            ? "该考勤异常已免除，不计入统计"
            : finalArchive
              ? "该考勤异常已归档并计入统计"
              : "经理已归档，等待管理员确认",
          targetId: id,
        },
      });
      if (!exempt && !finalArchive) {
        const admins = await tx.user.findMany({
          where: { role: { code: "ADMIN" }, status: "ACTIVE" },
        });
        if (admins.length)
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              type: "APPROVAL" as const,
              title: "考勤归档等待管理员确认",
              content: `${item.attendance.user.name}：${item.reason || item.type}`,
              targetId: id,
            })),
          });
      }
      await tx.operationLog.create({
        data: {
          userId: u.id,
          action: exempt ? "EXEMPT_ATTENDANCE" : "ARCHIVE_ATTENDANCE",
          module: "ATTENDANCE",
          targetId: id,
          description: p.data.comment || disposition,
        },
      });
      return x;
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_PROCESSED")
      return fail("该考勤事项已被处理", "ALREADY_PROCESSED", 409);
    return apiError(e);
  }
}
