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
import { cachedSalesUsers } from "@/lib/cached-data";
import { orderWhere } from "@/lib/order-query";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await requireUser(),
    params = await searchParams,
    draftView = params.drafts === "1",
    pageSize = 25,
    page = Math.max(1, Number(params.page) || 1),
    q = params.q?.trim() || "";
  const selectedPeriodLabel = params.createdFromValue || params.createdToValue
    ? `${params.createdFromValue || "不限"} 至 ${params.createdToValue || "不限"}`
    : null;
  const where = orderWhere(u, params);
  const [items, total, salesUsers, amountTotals, netTotals] = await Promise.all([db.order.findMany({
    where,
    select: { id: true, salesUserId: true, orderNumber: true, name: true, amount: true, approvalStatus: true, invoiceStatus: true, invoiceApplicationStatus: true, paymentStatus: true, status: true, createdAt: true, historicalSalesName: true, customer: { select: { id: true, name: true, collaborators: { select: { userId: true } } } }, salesUser: { select: { name: true } }, contract: { select: { netOrderAmount: true, technicalSupportFee: true, outsourcingFee: true, reviewFee: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  }), db.order.count({ where }), cachedSalesUsers(), db.order.aggregate({ where, _sum: { amount: true, paidAmount: true } }), draftView ? Promise.resolve({ _sum: { netOrderAmount: null } }) : db.contract.aggregate({ where: { order: { is: where } }, _sum: { netOrderAmount: true } })]);
  return (
    <>
      <PageHeader
        title={draftView ? "草稿箱" :
          
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
      <Card className="mb-5"><div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><strong>{u.role.code.startsWith("SALES") ? "订单与业绩" : "订单汇总"}</strong>{selectedPeriodLabel && <span>统计时间：{selectedPeriodLabel}</span>}<span className="text-zinc-500">当前筛选共 {total} 单</span></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">合同金额</p><p className="mt-1 text-xl font-semibold">{money(Number(amountTotals._sum.amount || 0))}</p></div><div className="rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">净签单金额</p><p className="mt-1 text-xl font-semibold">{money(Number(netTotals._sum.netOrderAmount || 0))}</p></div><div className="rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">已回款</p><p className="mt-1 text-xl font-semibold">{money(Number(amountTotals._sum.paidAmount || 0))}</p></div></div></Card>
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
