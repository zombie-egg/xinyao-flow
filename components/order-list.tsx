import Link from "next/link";
import { Badge } from "./ui/badge";
import { money, dateTime } from "@/lib/utils";
import {
  approvalStatusText,
  businessOrderStatus,
  isOrderCompleted,
} from "@/lib/order-workflow";
import { PeriodFilterFields } from "./period-filter-fields";
import { Funnel } from "lucide-react";
import type { ReactNode } from "react";

function FilterHeader({ label, active, children, wide = false }: { label: string; active?: boolean; children: ReactNode; wide?: boolean }) {
  return <th className="relative px-4 py-3 font-medium">
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <span>{label}</span><Funnel size={13} className={active ? "fill-orange-500 text-orange-500" : "text-zinc-400 group-open:text-zinc-900"} />
      </summary>
      <div className={`absolute left-2 top-[calc(100%-4px)] z-30 rounded-xl border bg-white p-3 font-normal text-zinc-900 shadow-xl ${wide ? "w-80" : "w-52"}`}>
        {children}
        <div className="mt-3 flex gap-2"><button className="h-8 rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white">筛选</button><Link href="/orders?status=ALL" className="inline-flex h-8 items-center rounded-lg border px-3 text-xs">清除</Link></div>
      </div>
    </details>
  </th>;
}
type Item = {
  id: string;
  salesUserId: string;
  orderNumber: string | null;
  name: string;
  amount: unknown;
  contract: { netOrderAmount: unknown; technicalSupportFee: unknown; outsourcingFee: unknown; reviewFee: unknown };
  approvalStatus: string;
  invoiceStatus: string;
  invoiceApplicationStatus: string;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  customer: { id: string; name: string };
  customerCollaboratorIds?: string[];
  salesUser: { name: string };
  historicalSalesName?: string | null;
};
export function OrderList({
  items,
  invoiceApplicantId,
  params,
  salesUsers,
}: {
  items: Item[];
  invoiceApplicantId?: string;
  params: Record<string, string | undefined>;
  salesUsers: { id: string; name: string }[];
}) {
  return (
    <form>
      {params.quick && <input type="hidden" name="quick" value={params.quick} />}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[1500px] whitespace-nowrap text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <FilterHeader label="订单号" active={Boolean(params.orderNumberQuery)}><input name="orderNumberQuery" defaultValue={params.orderNumberQuery} placeholder="输入订单号关键词" className="h-9 w-full rounded-lg border px-2 text-xs" /></FilterHeader>
              <FilterHeader label="订单名称" active={Boolean(params.orderNameQuery)}><input name="orderNameQuery" defaultValue={params.orderNameQuery} placeholder="输入订单名称关键词" className="h-9 w-full rounded-lg border px-2 text-xs" /></FilterHeader>
              <FilterHeader label="客户" active={Boolean(params.customerQuery)}><input name="customerQuery" defaultValue={params.customerQuery} placeholder="输入客户关键词" className="h-9 w-full rounded-lg border px-2 text-xs" /></FilterHeader>
              <FilterHeader label="销售人员" active={Boolean(params.salesUserId)}><select name="salesUserId" defaultValue={params.salesUserId || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部销售人员</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterHeader>
              <FilterHeader label="金额" active={Boolean(params.amountMin || params.amountMax)}><div className="grid grid-cols-2 gap-2"><input name="amountMin" type="number" step="0.01" defaultValue={params.amountMin} placeholder="最低" className="h-9 min-w-0 rounded-lg border px-2 text-xs" /><input name="amountMax" type="number" step="0.01" defaultValue={params.amountMax} placeholder="最高" className="h-9 min-w-0 rounded-lg border px-2 text-xs" /></div></FilterHeader>
              <th className="px-4 py-3 font-medium">信息费</th><th className="px-4 py-3 font-medium">外包费</th><th className="px-4 py-3 font-medium">评审费</th>
              <FilterHeader label="净签单金额" active={Boolean(params.netAmountMin || params.netAmountMax)}><div className="grid grid-cols-2 gap-2"><input name="netAmountMin" type="number" step="0.01" defaultValue={params.netAmountMin} placeholder="最低" className="h-9 min-w-0 rounded-lg border px-2 text-xs" /><input name="netAmountMax" type="number" step="0.01" defaultValue={params.netAmountMax} placeholder="最高" className="h-9 min-w-0 rounded-lg border px-2 text-xs" /></div></FilterHeader>
              <FilterHeader label="审核状态" active={Boolean(params.approvalStatus)}><select name="approvalStatus" defaultValue={params.approvalStatus || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部审核状态</option><option value="PENDING_SALES_MANAGER">等待销售经理</option><option value="PENDING_FINANCE">等待财务</option><option value="PENDING_ADMIN">等待管理员</option><option value="APPROVED">审核通过</option><option value="REJECTED">审核拒绝</option></select></FilterHeader>
              <FilterHeader label="订单状态" active={Boolean(params.status && params.status !== "ALL")}><select name="status" defaultValue={params.status || "ALL"} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="ALL">全部订单状态</option><option value="PROCESSING">处理中</option><option value="COMPLETED">已完成</option></select></FilterHeader>
              <FilterHeader label="创建时间" active={Boolean(params.createdFromValue || params.createdToValue)} wide><div className="grid gap-2"><PeriodFilterFields prefix="created" label="订单创建" params={params} /></div></FilterHeader>
              {invoiceApplicantId && <th className="px-4 py-3 font-medium">操作</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="px-4 py-4 font-medium">
                  <Link
                    href={`/orders/${x.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {x.orderNumber || "审核后生成"}
                  </Link>
                </td>
                <td className="px-4">{x.name}</td>
                <td className="px-4">{x.customer.name}</td>
                <td className="px-4">{x.historicalSalesName || x.salesUser.name}</td>
                <td className="px-4">{money(Number(x.amount))}</td>
                <td className="px-4">{money(Number(x.contract.technicalSupportFee))}</td>
                <td className="px-4">{money(Number(x.contract.outsourcingFee))}</td>
                <td className="px-4">{money(Number(x.contract.reviewFee))}</td>
                <td className="px-4">{money(Number(x.contract.netOrderAmount))}</td>
                <td className="px-4">
                  <Badge>
                    {approvalStatusText[x.approvalStatus] || "未知状态"}
                  </Badge>
                </td>
                <td className="px-4">
                  <Badge
                    className={
                      isOrderCompleted(x) ? "bg-red-50 text-red-600" : ""
                    }
                  >
                    {businessOrderStatus(x)}
                  </Badge>
                </td>
                <td className="px-4 text-zinc-500">{dateTime(x.createdAt)}</td>
                {invoiceApplicantId && (
                  <td className="px-4">
                    {x.salesUserId === invoiceApplicantId && x.approvalStatus === "DRAFT" ? (
                      <div className="flex gap-2">
                        <Link href={`/orders/${x.id}/edit`} className="inline-flex h-8 items-center rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white">编辑</Link>
                        <button type="button" className="inline-flex h-8 items-center rounded-lg border px-3 text-sm" onClick={async () => { if (!confirm("确定删除这个订单草稿吗？删除后不能恢复。")) return; const res = await fetch(`/api/orders/${x.id}`, { method: "DELETE" }); if (res.ok) window.location.reload(); }}>删除</button>
                      </div>
                    ) : (x.salesUserId === invoiceApplicantId || x.customerCollaboratorIds?.includes(invoiceApplicantId)) &&
                    x.status !== "CANCELLED" &&
                    [
                      "MANAGER_REJECTED",
                      "FINANCE_REJECTED",
                      "ADMIN_REJECTED",
                    ].includes(x.approvalStatus) ? (
                      <Link
                        href={`/orders/${x.id}/edit`}
                        className="inline-flex h-8 items-center rounded-lg bg-red-50 px-3 text-sm font-medium text-red-700"
                      >
                        修改订单
                      </Link>
                    ) : (x.salesUserId === invoiceApplicantId || x.customerCollaboratorIds?.includes(invoiceApplicantId)) &&
                    x.approvalStatus === "APPROVED" &&
                    x.invoiceApplicationStatus === "PENDING" ? (
                      <Link
                        href={`/invoice-applications#order-${x.id}`}
                        className="inline-flex h-8 items-center rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white"
                      >
                        申请开票
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
