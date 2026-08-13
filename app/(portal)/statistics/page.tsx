import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { statisticsDateRange, statisticsOrderWhere } from "@/lib/statistics";

export default async function Statistics({ searchParams }: { searchParams: Promise<{ start?: string; end?: string }> }) {
  await requirePermission("statistics:view");
  const query = await searchParams;
  const range = statisticsDateRange(query.start, query.end);
  const where = statisticsOrderWhere(range);
  const [rows, paymentAggregate] = await Promise.all([
    db.order.groupBy({ by: ["salesUserId"], where, _count: { id: true }, _sum: { amount: true, paidAmount: true }, orderBy: { _sum: { amount: "desc" } } }),
    db.payment.aggregate({ where: { order: where }, _sum: { amount: true } }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: rows.map((row) => row.salesUserId) } }, select: { id: true, name: true } });
  const totalCount = rows.reduce((sum, row) => sum + row._count.id, 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
  const paidAmount = Number(paymentAggregate._sum.amount || 0);
  return <>
    <PageHeader title="财务统计" description="默认统计全部已审核订单；历史导入和以后新增/导入的数据会实时更新" />
    <Card className="mb-5"><form className="flex flex-wrap items-end gap-3"><label className="text-sm">合同开始日期<input name="start" type="date" defaultValue={query.start} className="ml-2 h-10 rounded-lg border px-3" /></label><label className="text-sm">合同结束日期<input name="end" type="date" defaultValue={query.end} className="ml-2 h-10 rounded-lg border px-3" /></label><button className="h-10 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white">查询</button><a href="/statistics" className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm">全部时间</a></form></Card>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card><p className="text-sm text-zinc-500">订单总数</p><p className="mt-3 text-3xl font-semibold">{totalCount}</p></Card><Card><p className="text-sm text-zinc-500">合同总额</p><p className="mt-3 text-3xl font-semibold">{money(totalAmount)}</p></Card><Card><p className="text-sm text-zinc-500">实际回款</p><p className="mt-3 text-3xl font-semibold">{money(paidAmount)}</p></Card><Card><p className="text-sm text-zinc-500">待回款</p><p className="mt-3 text-3xl font-semibold">{money(Math.max(0, totalAmount - paidAmount))}</p></Card></div>
    {!rows.length ? <Empty /> : <Card><div className="space-y-5">{rows.map((row, index) => { const amount = Number(row._sum.amount || 0); const max = Math.max(...rows.map((item) => Number(item._sum.amount || 0))); return <div key={row.salesUserId}><div className="mb-2 flex justify-between gap-4 text-sm"><span>{index + 1}. {users.find((user) => user.id === row.salesUserId)?.name}</span><span>{row._count.id} 单 · {money(amount)} · 已回款 {money(Number(row._sum.paidAmount || 0))}</span></div><div className="h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-zinc-900" style={{ width: `${max ? Math.max(4, amount / max * 100) : 0}%` }} /></div></div>; })}</div></Card>}
  </>;
}
