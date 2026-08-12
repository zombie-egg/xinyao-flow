import Link from "next/link";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function OrderFilters({
  params,
  salesUsers,
}: {
  params: Record<string, string | undefined>;
  salesUsers: { id: string; name: string }[];
}) {
  return (
    <form className="mb-5 rounded-xl border bg-white p-4">
      <input type="hidden" name="status" value={params.status || "ALL"} />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Input name="q" defaultValue={params.q} placeholder="搜索订单号、名称、客户或联系人" />
        <select name="salesUserId" defaultValue={params.salesUserId || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部销售人员</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select name="approvalStatus" defaultValue={params.approvalStatus || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部审核状态</option><option value="PENDING_SALES_MANAGER">等待销售经理</option><option value="PENDING_FINANCE">等待财务</option><option value="PENDING_ADMIN">等待管理员</option><option value="APPROVED">审核通过</option><option value="REJECTED">审核拒绝</option></select>
        <select name="invoiceStage" defaultValue={params.invoiceStage || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部开票阶段</option><option value="TO_APPLY">待申请开票</option><option value="TO_INVOICE">待开发票</option><option value="INVOICED">已开发票</option></select>
        <select name="paymentStage" defaultValue={params.paymentStage || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部回款状态</option><option value="PENDING">未回款</option><option value="PARTIAL">部分回款</option><option value="COMPLETED">已回款</option></select>
        <Input name="amountMin" type="number" step="0.01" defaultValue={params.amountMin} placeholder="最低金额" />
        <Input name="amountMax" type="number" step="0.01" defaultValue={params.amountMax} placeholder="最高金额" />
        <Input name="createdFrom" type="date" defaultValue={params.createdFrom} title="创建时间起" />
        <Input name="createdTo" type="date" defaultValue={params.createdTo} title="创建时间止" />
      </div>
      <div className="mt-3 flex gap-2"><Button type="submit">筛选</Button><Link href="/orders?status=ALL" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm">清除筛选</Link></div>
    </form>
  );
}
