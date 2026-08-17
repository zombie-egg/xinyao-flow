import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { statisticsDateRange, statisticsOrderWhere } from "@/lib/statistics";

export default async function Performance({ searchParams }: { searchParams: Promise<{ start?: string; end?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const canAll = user.role.code === "ADMIN" || user.role.code.startsWith("FINANCE");
  const self = user.role.code.startsWith("SALES");
  if (self) redirect("/orders");
  if (!canAll && !self) throw new Error("FORBIDDEN");
  const range = statisticsDateRange(query.start, query.end);
  const where = statisticsOrderWhere({ ...range, ...(self ? { salesUserId: user.id } : {}) });
  const rows = await db.order.groupBy({ by: ["salesUserId", "historicalSalesName"], where, _count: { id: true }, _sum: { amount: true, paidAmount: true }, orderBy: { _sum: { amount: "desc" } } });
  const users = await db.user.findMany({ where: { id: { in: rows.map((row) => row.salesUserId) } }, select: { id: true, name: true } });
  const totalCount = rows.reduce((sum, row) => sum + row._count.id, 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
  const paidAmount = rows.reduce((sum, row) => sum + Number(row._sum.paidAmount || 0), 0);
  return <>
    <PageHeader title={self ? "我的业绩" : "销售业绩"} description="默认统计全部已审核订单；可按合同签订日期筛选，历史导入和后续导入会自动计入" />
    <Card className="mb-5"><form className="flex flex-wrap items-end gap-3"><label className="text-sm">开始日期<input name="start" type="date" defaultValue={query.start} className="ml-2 h-10 rounded-lg border px-3" /></label><label className="text-sm">结束日期<input name="end" type="date" defaultValue={query.end} className="ml-2 h-10 rounded-lg border px-3" /></label><button className="h-10 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white">查询</button><a href="/performance" className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm">全部时间</a></form></Card>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><Card><p className="text-sm text-zinc-500">签约数量</p><p className="mt-2 text-3xl font-semibold">{totalCount}</p></Card><Card><p className="text-sm text-zinc-500">签约金额</p><p className="mt-2 text-3xl font-semibold">{money(totalAmount)}</p></Card><Card><p className="text-sm text-zinc-500">已回款</p><p className="mt-2 text-3xl font-semibold">{money(paidAmount)}</p></Card></div>
    {rows.length ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-3">销售人员</th><th className="px-4 py-3">订单数量</th><th className="px-4 py-3">订单金额</th><th className="px-4 py-3">已回款</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.salesUserId}-${row.historicalSalesName || "active"}`} className="border-t"><td className="px-4 py-4 font-medium">{row.historicalSalesName || users.find((item) => item.id === row.salesUserId)?.name}</td><td className="px-4">{row._count.id}</td><td className="px-4">{money(Number(row._sum.amount || 0))}</td><td className="px-4">{money(Number(row._sum.paidAmount || 0))}</td></tr>)}</tbody></table></div> : <Empty text="所选时间范围暂无已审核订单" />}
  </>;
}
