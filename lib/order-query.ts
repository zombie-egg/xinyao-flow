import type { Prisma, RoleCode } from "@prisma/client";
import { flexiblePeriodRange } from "./period-range";

type OrderQueryUser = {
  id: string;
  departmentId: string | null;
  role: { code: RoleCode };
};

export function orderWhere(
  user: OrderQueryUser,
  params: Record<string, string | undefined>,
  now = new Date(),
  unauthorized: "throw" | "empty" = "throw",
): Prisma.OrderWhereInput {
  const draftView = params.drafts === "1";
  if (draftView)
    return { salesUserId: user.id, approvalStatus: "DRAFT" };

  const baseWhere: Prisma.OrderWhereInput | null =
    user.role.code === "SALES_MANAGER"
      ? { AND: [{ approvalStatus: { not: "DRAFT" } }, { salesUser: { departmentId: user.departmentId } }] }
      : user.role.code === "SALES_EMPLOYEE"
        ? { OR: [{ salesUserId: user.id, approvalStatus: { not: "DRAFT" } }, { approvalStatus: { not: "DRAFT" }, customer: { ownerId: user.id } }, { approvalStatus: { not: "DRAFT" }, customer: { collaborators: { some: { userId: user.id } } } }] }
        : user.role.code === "TECH_MANAGER"
          ? { historicalSalesName: null, approvalStatus: "APPROVED" }
          : user.role.code === "TECH_EMPLOYEE"
            ? { historicalSalesName: null, approvalStatus: "APPROVED", technicalUserId: user.id }
            : user.role.code.startsWith("FINANCE") || user.role.code === "ADMIN"
              ? { approvalStatus: { not: "DRAFT" } }
              : null;
  if (!baseWhere) {
    if (unauthorized === "empty") return { id: "__NONE__" };
    throw new Error("FORBIDDEN");
  }

  const todayStart = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) + "T00:00:00+08:00");
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const selectedRange = flexiblePeriodRange(params.createdFromMode, params.createdFromValue, params.createdToMode, params.createdToValue);
  const statusFilter = params.status === "COMPLETED" ? "COMPLETED" : params.status === "PROCESSING" ? "PROCESSING" : "ALL";
  const q = params.q?.trim() || "";

  const statusWhere: Prisma.OrderWhereInput = statusFilter === "COMPLETED"
    ? { OR: [{ status: "COMPLETED" }, { paymentStatus: "COMPLETED" }] }
    : statusFilter === "PROCESSING"
      ? { AND: [{ status: { not: "COMPLETED" } }, { paymentStatus: { not: "COMPLETED" } }] }
      : {};
  const searchWhere: Prisma.OrderWhereInput = q ? { OR: [
    { orderNumber: { contains: q, mode: "insensitive" } },
    { name: { contains: q, mode: "insensitive" } },
    { customer: { name: { contains: q, mode: "insensitive" } } },
    { customer: { contact: { contains: q, mode: "insensitive" } } },
    { customer: { phone: { contains: q } } },
    { salesUser: { name: { contains: q, mode: "insensitive" } } },
    { historicalSalesName: { contains: q, mode: "insensitive" } },
  ] } : {};
  const extraWhere: Prisma.OrderWhereInput = { AND: [
    params.quick === "today" ? { createdAt: { gte: todayStart } } : params.quick === "week" ? { createdAt: { gte: weekStart } } : params.quick === "mine" ? { salesUserId: user.id } : params.quick === "collaborative" ? { customer: { collaborators: { some: { userId: user.id } } } } : {},
    params.orderNumberQuery ? { orderNumber: { contains: params.orderNumberQuery, mode: "insensitive" } } : {},
    params.orderNameQuery ? { name: { contains: params.orderNameQuery, mode: "insensitive" } } : {},
    params.customerQuery ? { customer: { name: { contains: params.customerQuery, mode: "insensitive" } } } : {},
    params.category ? { category: params.category as "XINYAO_ENVIRONMENT" | "OCCUPATIONAL_HEALTH" } : {},
    params.salesUserId ? { salesUserId: params.salesUserId } : {},
    params.contractStatus ? { contract: { signingStatus: params.contractStatus as "SIGNED" | "PENDING_SIGNATURE" } } : {},
    params.approvalStatus === "REJECTED" ? { approvalStatus: { in: ["MANAGER_REJECTED", "FINANCE_REJECTED", "ADMIN_REJECTED"] } } : params.approvalStatus ? { approvalStatus: params.approvalStatus as "PENDING_SALES_MANAGER" | "PENDING_FINANCE" | "PENDING_ADMIN" | "APPROVED" } : {},
    params.invoiceStage === "TO_APPLY" ? { invoiceApplicationStatus: "PENDING" } : params.invoiceStage === "TO_INVOICE" ? { invoiceApplicationStatus: "COMPLETED", invoiceStatus: "PENDING" } : params.invoiceStage === "INVOICED" ? { invoiceStatus: "COMPLETED" } : {},
    params.paymentStage ? { paymentStatus: params.paymentStage as "PENDING" | "PARTIAL" | "COMPLETED" } : {},
    params.amountMin || params.amountMax ? { amount: { ...(params.amountMin ? { gte: Number(params.amountMin) } : {}), ...(params.amountMax ? { lte: Number(params.amountMax) } : {}) } } : {},
    params.netAmountMin || params.netAmountMax ? { contract: { netOrderAmount: { ...(params.netAmountMin ? { gte: Number(params.netAmountMin) } : {}), ...(params.netAmountMax ? { lte: Number(params.netAmountMax) } : {}) } } } : {},
    selectedRange ? { createdAt: selectedRange } : {},
  ] };
  return { AND: [baseWhere, statusWhere, searchWhere, extraWhere] };
}
