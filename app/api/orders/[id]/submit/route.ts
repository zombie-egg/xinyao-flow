import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { hasSalesCapabilities } from "@/lib/customer-access";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!hasSalesCapabilities(user.role.code)) throw new Error("FORBIDDEN");
    const order = await db.order.findUnique({
      where: { id },
      include: { contract: true, receivable: true, customer: { select: { ownerId: true, collaborators: { select: { userId: true } } } } },
    });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    if (order.salesUserId !== user.id) throw new Error("FORBIDDEN");
    if (order.approvalStatus !== "DRAFT") return fail("只有草稿可以提交", "INVALID_STATE", 409);
    if (!order.contract.fileUrl) return fail("请先编辑并上传合同附件后再提交", "CONTRACT_REQUIRED", 409);
    const managerCreated = user.role.code === "SALES_MANAGER" || user.role.code === "ADMIN";
    const approvalStatus = managerCreated ? "PENDING_FINANCE" : "PENDING_SALES_MANAGER";
    const updated = await db.$transaction(async (tx) => {
      const item = await tx.order.update({ where: { id }, data: { approvalStatus, status: approvalStatus } });
      await tx.contract.update({ where: { id: order.contractId }, data: { status: "SUBMITTED" } });
      const recipients = managerCreated
        ? await tx.user.findMany({ where: { department: { code: "FINANCE" }, status: "ACTIVE" }, select: { id: true } })
        : await tx.user.findMany({ where: { role: { code: "SALES_MANAGER" }, departmentId: user.departmentId, status: "ACTIVE" }, select: { id: true } });
      if (recipients.length) await tx.notification.createMany({ data: recipients.map((r) => ({ userId: r.id, type: "APPROVAL" as const, title: "新订单待审核", content: `${user.name}提交了订单“${item.name}”`, targetId: id })) });
      await tx.operationLog.create({ data: { userId: user.id, action: "SUBMIT_ORDER_DRAFT", module: "ORDER", targetId: id, description: `提交订单草稿“${item.name}”审核` } });
      return item;
    });
    return ok(updated);
  } catch (error) {
    return apiError(error);
  }
}
