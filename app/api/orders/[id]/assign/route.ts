import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ technicalUserId: z.string().min(1) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const manager = await requireUser();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (manager.role.code !== "TECH_MANAGER") throw new Error("FORBIDDEN");
    if (!parsed.success) return fail("请选择技术员工", "VALIDATION_ERROR");
    const employee = await db.user.findFirst({
      where: {
        id: parsed.data.technicalUserId,
        role: { code: "TECH_EMPLOYEE" },
        department: { code: "TECH" },
        status: "ACTIVE",
      },
    });
    if (!employee)
      return fail("技术员工不存在或已禁用", "TECH_USER_NOT_FOUND", 404);

    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id } });
      if (!order || order.approvalStatus !== "APPROVED")
        throw new Error("ORDER_NOT_APPROVED");
      if (order.technicalUserId) throw new Error("ALREADY_ASSIGNED");
      const item = await tx.order.update({
        where: { id },
        data: {
          technicalUserId: employee.id,
          technicalStatus: "PENDING",
          status: "IN_PROGRESS",
        },
      });
      await tx.notification.create({
        data: {
          userId: employee.id,
          type: "ORDER",
          title: "新的技术订单任务",
          content: `${item.orderNumber} · ${item.name}`,
          targetId: id,
        },
      });
      await tx.operationLog.create({
        data: {
          userId: manager.id,
          action: "ASSIGN_TECH_ORDER",
          module: "ORDER",
          targetId: id,
          description: `技术经理将订单分配给 ${employee.name}`,
        },
      });
      return item;
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_ASSIGNED")
      return fail("该订单已分配，不能重复分配", "ALREADY_ASSIGNED", 409);
    if (error instanceof Error && error.message === "ORDER_NOT_APPROVED")
      return fail("订单尚未通过审核", "ORDER_NOT_APPROVED", 409);
    return apiError(error);
  }
}
