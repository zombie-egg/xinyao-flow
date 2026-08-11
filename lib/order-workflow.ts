import type { Prisma } from "@prisma/client";
export const orderStatusText: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_SALES_MANAGER: "等待销售经理审核",
  PENDING_FINANCE: "等待财务审核",
  PENDING_ADMIN: "等待管理员审核",
  APPROVED: "审核通过",
  IN_PROGRESS: "处理中",
  CREATED: "已创建",
  FINANCE_PROCESSING: "财务处理中",
  TECH_PENDING: "技术待分配",
  TECH_RECEIVED: "技术处理中",
  TECH_COMPLETED: "技术已完成",
  COMPLETED: "已完成",
  REJECTED: "已拒绝",
  CANCELLED: "已取消",
};
export const approvalStatusText: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_SALES_MANAGER: "等待销售经理审核",
  PENDING_FINANCE: "等待财务审核",
  PENDING_ADMIN: "等待管理员审核",
  APPROVED: "审核通过",
  MANAGER_REJECTED: "销售经理已拒绝",
  FINANCE_REJECTED: "财务已拒绝",
  ADMIN_REJECTED: "管理员已拒绝",
};
export const processStatusText: Record<string, string> = {
  NOT_REQUIRED: "尚未处理",
  PENDING: "待处理",
  PARTIAL: "部分回款",
  COMPLETED: "已完成",
};
export const technicalStatusText: Record<string, string> = {
  PENDING: "等待技术经理分配",
  PROCESSING: "处理中",
  COMPLETED: "技术已完成",
};
export function isOrderCompleted(order: {
  status: string;
  paymentStatus: string;
}) {
  return order.status === "COMPLETED" || order.paymentStatus === "COMPLETED";
}
export function businessOrderStatus(order: {
  approvalStatus: string;
  invoiceStatus: string;
  invoiceApplicationStatus?: string;
  paymentStatus: string;
  status: string;
}) {
  if (order.status === "CANCELLED") return "已取消";
  if (isOrderCompleted(order)) return "已完成";
  if (order.approvalStatus !== "APPROVED")
    return order.approvalStatus.endsWith("REJECTED")
      ? "合同已拒绝"
      : "合同待审批";
  if (order.invoiceApplicationStatus === "PENDING") return "待申请开票";
  if (
    order.invoiceStatus === "PENDING" ||
    order.invoiceStatus === "NOT_REQUIRED"
  )
    return "待开发票";
  if (order.paymentStatus === "PENDING" || order.paymentStatus === "PARTIAL")
    return "待收回款";
  return orderStatusText[order.status] || "处理中";
}
export async function updateCompletion(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const complete = order.paymentStatus === "COMPLETED";
  return tx.order.update({
    where: { id: orderId },
    data: {
      status: complete
        ? "COMPLETED"
        : order.approvalStatus === "APPROVED"
          ? "IN_PROGRESS"
          : order.status,
    },
  });
}
