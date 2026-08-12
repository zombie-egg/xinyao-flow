import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { fullWorkYears } from "@/lib/work-years";
import { z } from "zod";

const schema = z.union([
  z.object({ employmentStartDate: z.coerce.date() }),
  z.object({ status: z.enum(["ACTIVE", "DISABLED"]) }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requirePermission("user:manage");
    if (admin.role.code !== "ADMIN")
      return fail("只有管理员可以修改员工信息和账号状态", "FORBIDDEN", 403);
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return fail(parsed.error.issues[0].message, "VALIDATION_ERROR");
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return fail("员工不存在", "NOT_FOUND", 404);

    const data = parsed.data;
    if ("status" in data) {
      const status = data.status;
      if (id === admin.id && status === "DISABLED")
        return fail("不能禁用当前登录的管理员账号", "CANNOT_DISABLE_SELF", 409);
      const updated = await db.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: { status },
        });
        await tx.operationLog.create({
          data: {
            userId: admin.id,
            action: status === "ACTIVE" ? "ENABLE_USER" : "DISABLE_USER",
            module: "USER",
            targetId: id,
            description: `${status === "ACTIVE" ? "启用" : "禁用"}员工账号：${user.name}`,
          },
        });
        return user;
      });
      return ok({ id: updated.id, name: updated.name, status: updated.status });
    }

    const employmentStartDate = data.employmentStartDate;
    const workYears = fullWorkYears(employmentStartDate);
    if (workYears < 0)
      return fail("入职时间不能晚于今天", "INVALID_EMPLOYMENT_DATE", 400);
    if (workYears < Number(existing.annualLeaveUsed))
      return fail(
        `入职时间对应年假不能少于已使用年假（${Number(existing.annualLeaveUsed)} 天）`,
        "ANNUAL_LEAVE_USED_EXCEEDS_TOTAL",
        409,
      );
    const updated = await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          employmentStartDate,
          workYears,
          annualLeaveDays: workYears,
        },
      });
      await tx.operationLog.create({
        data: {
          userId: admin.id,
          action: "UPDATE_USER_WORK_INFO",
          module: "USER",
          targetId: id,
          description: `更新员工 ${user.name} 的入职时间，系统自动计算工龄和年假`,
        },
      });
      return user;
    });
    return ok({
      id: updated.id,
      name: updated.name,
      employmentStartDate: updated.employmentStartDate,
      workYears: updated.workYears,
      annualLeaveDays: updated.annualLeaveDays,
      employeeNumber: updated.employeeNumber,
      status: updated.status,
    });
  } catch (error) {
    return apiError(error);
  }
}
