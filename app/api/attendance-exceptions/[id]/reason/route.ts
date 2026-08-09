import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";
const schema = z.object({
  reason: z.string().trim().min(2, "请填写至少 2 个字的原因").max(1000),
});
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(),
      { id } = await params,
      p = schema.safeParse(await req.json());
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const exception = await db.attendanceException.findUnique({
      where: { id },
      include: { attendance: true },
    });
    if (!exception) return fail("考勤异常不存在", "NOT_FOUND", 404);
    if (exception.attendance.userId !== user.id)
      return fail("只能填写自己的考勤原因", "FORBIDDEN", 403);
    if (!["PENDING_MANAGER", "PENDING_ADMIN"].includes(exception.status))
      return fail("该考勤异常已经处理，不能修改原因", "ALREADY_PROCESSED", 409);
    const updated = await db.$transaction(async (tx) => {
      const item = await tx.attendanceException.update({
          where: { id },
          data: { reason: p.data.reason, disposition: "PENDING" },
        }),
        recipients =
          exception.status === "PENDING_ADMIN"
            ? await tx.user.findMany({
                where: { role: { code: "ADMIN" }, status: "ACTIVE" },
              })
            : await tx.user.findMany({
                where: {
                  departmentId: user.departmentId,
                  role: { code: { in: ["SALES_MANAGER", "TECH_MANAGER"] } },
                  status: "ACTIVE",
                },
              });
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            type: "APPROVAL" as const,
            title: "员工提交考勤异常说明",
            content: `${user.name}：${p.data.reason}`,
            targetId: id,
          })),
        });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "EXPLAIN_ATTENDANCE_EXCEPTION",
          module: "ATTENDANCE",
          targetId: id,
          description: p.data.reason,
        },
      });
      return item;
    });
    return ok(updated);
  } catch (e) {
    return apiError(e);
  }
}
