import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { hasSalesCapabilities } from "@/lib/customer-access";

const pendingStatuses = [
  "PENDING_SALES_MANAGER",
  "PENDING_FINANCE",
  "PENDING_ADMIN",
] as const;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!hasSalesCapabilities(user.role.code)) throw new Error("FORBIDDEN");
    const order = await db.order.findUnique({
      where: { id },
      include: { customer: { include: { collaborators: { select: { userId: true } } } } },
    });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    if (order.historicalSalesName)
      return fail("离职人员历史订单仅用于查询和统计", "HISTORICAL_ORDER_READ_ONLY", 409);
    if (order.salesUserId !== user.id && !order.customer.collaborators.some((x) => x.userId === user.id))
      throw new Error("FORBIDDEN");
    if (!pendingStatuses.includes(order.approvalStatus as (typeof pendingStatuses)[number]))
      return fail("只有审核中的订单可以撤回", "INVALID_STATE", 409);
    const updated = await db.$transaction(async (tx) => {
      const item = await tx.order.update({
        where: { id },
        data: { approvalStatus: "DRAFT", status: "DRAFT" },
      });
      await tx.contract.update({ where: { id: order.contractId }, data: { status: "DRAFT" } });
      await tx.notification.deleteMany({
        where: { targetId: id, type: "APPROVAL", readAt: null },
      });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "WITHDRAW_ORDER",
          module: "ORDER",
          targetId: id,
          description: `撤回订单“${order.name}”并修改后重新提交审核`,
        },
      });
      return item;
    });
    return ok(updated);
  } catch (error) {
    return apiError(error);
  }
}
