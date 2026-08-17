import { hasSalesCapabilities } from "@/lib/customer-access";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { OrderList } from "@/components/order-list";
import { OrderFilters } from "@/components/order-filters";
import { DataImportExport } from "@/components/data-import-export";
import { Pagination } from "@/components/pagination";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { flexiblePeriodRange } from "@/lib/period-range";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await requireUser(),
    params = await searchParams,
    pageSize = 25,
    page = Math.max(1, Number(params.page) || 1),
    q = params.q?.trim() || "",
    statusFilter =
      params.status === "COMPLETED"
        ? "COMPLETED"
        : params.status === "PROCESSING"
          ? "PROCESSING"
          : "ALL",
    baseWhere = u.role.code === "SALES_MANAGER"
      ? { salesUser: { departmentId: u.departmentId } }
      : u.role.code === "SALES_EMPLOYEE"
        ? { OR: [{ salesUserId: u.id }, { customer: { collaborators: { some: { userId: u.id } } } }] }
      : u.role.code === "TECH_MANAGER"
        ? { historicalSalesName: null, approvalStatus: "APPROVED" as const }
        : u.role.code === "TECH_EMPLOYEE"
          ? { historicalSalesName: null, approvalStatus: "APPROVED" as const, technicalUserId: u.id }
          : u.role.code.startsWith("FINANCE") || u.role.code === "ADMIN"
            ? {}
            : null;
  if (!baseWhere) throw new Error("FORBIDDEN");
  const now = new Date();
  const todayStart = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) + "T00:00:00+08:00");
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const selectedRange = flexiblePeriodRange(params.createdFromMode, params.createdFromValue, params.createdToMode, params.createdToValue);
  const createdTimeWhere = selectedRange ? { createdAt: selectedRange } : {};
  const selectedPeriodLabel = params.createdFromValue || params.createdToValue
    ? `${params.createdFromValue || "不限"} 至 ${params.createdToValue || "不限"}`
    : null;
  const statusWhere =
      statusFilter === "COMPLETED"
        ? {
            OR: [
              { status: "COMPLETED" as const },
              { paymentStatus: "COMPLETED" as const },
            ],
          }
        : statusFilter === "PROCESSING"
          ? {
              AND: [
                { status: { not: "COMPLETED" as const } },
                { paymentStatus: { not: "COMPLETED" as const } },
              ],
            }
          : {},
    searchWhere = q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            {
              customer: { name: { contains: q, mode: "insensitive" as const } },
            },
            {
              customer: {
                contact: { contains: q, mode: "insensitive" as const },
              },
            },
            { customer: { phone: { contains: q } } },
            {
              salesUser: {
                name: { contains: q, mode: "insensitive" as const },
              },
            },
            { historicalSalesName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {},
    extraWhere = {
      AND: [
        params.quick === "today" ? { createdAt: { gte: todayStart } } : params.quick === "week" ? { createdAt: { gte: weekStart } } : params.quick === "mine" ? { salesUserId: u.id } : params.quick === "collaborative" ? { customer: { collaborators: { some: { userId: u.id } } } } : {},
        params.orderNumberQuery ? { orderNumber: { contains: params.orderNumberQuery, mode: "insensitive" as const } } : {},
        params.orderNameQuery ? { name: { contains: params.orderNameQuery, mode: "insensitive" as const } } : {},
        params.customerQuery ? { customer: { name: { contains: params.customerQuery, mode: "insensitive" as const } } } : {},
        params.category ? { category: params.category as "XINYAO_ENVIRONMENT" | "OCCUPATIONAL_HEALTH" } : {},
        params.salesUserId ? { salesUserId: params.salesUserId } : {},
        params.contractStatus ? { contract: { signingStatus: params.contractStatus as "SIGNED" | "PENDING_SIGNATURE" } } : {},
        params.approvalStatus === "REJECTED" ? { approvalStatus: { in: ["MANAGER_REJECTED" as const,"FINANCE_REJECTED" as const,"ADMIN_REJECTED" as const] } } : params.approvalStatus ? { approvalStatus: params.approvalStatus as "PENDING_SALES_MANAGER"|"PENDING_FINANCE"|"PENDING_ADMIN"|"APPROVED" } : {},
        params.invoiceStage === "TO_APPLY" ? { invoiceApplicationStatus: "PENDING" as const } : params.invoiceStage === "TO_INVOICE" ? { invoiceApplicationStatus: "COMPLETED" as const, invoiceStatus: "PENDING" as const } : params.invoiceStage === "INVOICED" ? { invoiceStatus: "COMPLETED" as const } : {},
        params.paymentStage ? { paymentStatus: params.paymentStage as "PENDING"|"PARTIAL"|"COMPLETED" } : {},
        params.amountMin || params.amountMax ? { amount: { ...(params.amountMin ? { gte: Number(params.amountMin) } : {}), ...(params.amountMax ? { lte: Number(params.amountMax) } : {}) } } : {},
        createdTimeWhere,
      ],
    };
  const where = { AND: [baseWhere, statusWhere, searchWhere, extraWhere] };
  const [items, total, salesUsers, amountTotals, netTotals, paidTotals] = await Promise.all([db.order.findMany({
    where,
    include: { customer: { include: { collaborators: { select: { userId: true } } } }, salesUser: { select: { name: true } }, contract: { select: { netOrderAmount: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  }), db.order.count({ where }), db.user.findMany({ where: { status: "ACTIVE", role: { code: { in: ["ADMIN","SALES_MANAGER","SALES_EMPLOYEE"] } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.order.aggregate({ where, _sum: { amount: true } }), db.contract.aggregate({ where: { order: { is: where } }, _sum: { netOrderAmount: true } }), db.order.aggregate({ where, _sum: { paidAmount: true } })]);
  return (
    <>
      <PageHeader
        title={
          u.role.code === "SALES_EMPLOYEE"
            ? "我的订单"
            : u.role.code === "SALES_MANAGER"
              ? "订单管理"
            : u.role.code.startsWith("TECH")
              ? "订单查询"
              : "订单管理"
        }
        description="点击订单号查看客户、合同、项目需求、财务信息和流程记录"
      />
      <OrderFilters params={params} salesUsers={salesUsers} canImport={u.role.code === "ADMIN" || u.role.code === "SALES_MANAGER"} />
      <DataImportExport entity="orders" canImport={u.role.code === "ADMIN" || u.role.code === "SALES_MANAGER"} hideToolbar />
      <Card className="mb-5"><div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><strong>{u.role.code.startsWith("SALES") ? "订单与业绩" : "订单汇总"}</strong>{selectedPeriodLabel && <span>统计时间：{selectedPeriodLabel}</span>}<span className="text-zinc-500">当前筛选共 {total} 单</span></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">合同金额</p><p className="mt-1 text-xl font-semibold">{money(Number(amountTotals._sum.amount || 0))}</p></div><div className="rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">净签单金额</p><p className="mt-1 text-xl font-semibold">{money(Number(netTotals._sum.netOrderAmount || 0))}</p></div><div className="rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">已回款</p><p className="mt-1 text-xl font-semibold">{money(Number(paidTotals._sum.paidAmount || 0))}</p></div></div></Card>
      {items.length ? (
        <OrderList
          items={items.map((item) => ({ ...item, customerCollaboratorIds: item.customer.collaborators.map((x) => x.userId) }))}
          invoiceApplicantId={hasSalesCapabilities(u.role.code) ? u.id : undefined}
          params={params}
          salesUsers={salesUsers}
        />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <Link
              href="/orders?status=ALL"
              className="rounded-lg border bg-white px-3 py-2 text-sm"
            >
              全部
            </Link>
            <Link
              href="/orders?status=PROCESSING"
              className="rounded-lg border bg-white px-3 py-2 text-sm"
            >
              处理中
            </Link>
            <Link
              href="/orders?status=COMPLETED"
              className="rounded-lg border bg-white px-3 py-2 text-sm"
            >
              已完成
            </Link>
          </div>
          <Empty text={q ? "没有匹配的订单" : "暂无订单"} />
        </>
      )}
      <Pagination pathname="/orders" params={params} page={page} pageSize={pageSize} total={total} />
    </>
  );
}
