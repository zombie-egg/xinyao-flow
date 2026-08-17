import Link from "next/link";
import { Badge } from "./ui/badge";
import { money, dateTime } from "@/lib/utils";
import {
  approvalStatusText,
  businessOrderStatus,
  isOrderCompleted,
} from "@/lib/order-workflow";
import { PeriodFilterFields } from "./period-filter-fields";
type Item = {
  id: string;
  salesUserId: string;
  orderNumber: string | null;
  name: string;
  amount: unknown;
  contract: { netOrderAmount: unknown };
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
      <div className="mb-2 flex justify-end gap-2">
        <button className="h-8 rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white">应用表头筛选</button>
        <Link href="/orders?status=ALL" className="inline-flex h-8 items-center rounded-lg border bg-white px-3 text-xs">清除</Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[1500px] whitespace-nowrap text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              {[
                "订单号",
                "订单名称",
                "客户",
                "销售人员",
                "金额",
                "净签单金额",
                "审核状态",
                "订单状态",
                "创建时间",
                ...(invoiceApplicantId ? ["操作"] : []),
              ].map((x) => (
                <th key={x} className="px-4 py-3 font-medium">
                  {x}
                </th>
              ))}
            </tr>
            <tr className="border-t bg-white align-top">
              <th className="px-2 py-2"><input name="orderNumberQuery" defaultValue={params.orderNumberQuery} placeholder="关键词" className="h-9 w-36 rounded-lg border px-2 text-xs font-normal text-zinc-900" /></th>
              <th className="px-2 py-2"><input name="orderNameQuery" defaultValue={params.orderNameQuery} placeholder="关键词" className="h-9 w-36 rounded-lg border px-2 text-xs font-normal text-zinc-900" /></th>
              <th className="px-2 py-2"><input name="customerQuery" defaultValue={params.customerQuery} placeholder="关键词" className="h-9 w-40 rounded-lg border px-2 text-xs font-normal text-zinc-900" /></th>
              <th className="px-2 py-2"><select name="salesUserId" defaultValue={params.salesUserId || ""} className="h-9 w-32 rounded-lg border bg-white px-2 text-xs font-normal text-zinc-900"><option value="">全部</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></th>
              <th className="px-2 py-2"><div className="flex gap-1"><input name="amountMin" type="number" step="0.01" defaultValue={params.amountMin} placeholder="最低" className="h-9 w-20 rounded-lg border px-2 text-xs font-normal text-zinc-900" /><input name="amountMax" type="number" step="0.01" defaultValue={params.amountMax} placeholder="最高" className="h-9 w-20 rounded-lg border px-2 text-xs font-normal text-zinc-900" /></div></th>
              <th className="px-2 py-2 text-xs font-normal text-zinc-400">随金额筛选</th>
              <th className="px-2 py-2"><select name="approvalStatus" defaultValue={params.approvalStatus || ""} className="h-9 w-32 rounded-lg border bg-white px-2 text-xs font-normal text-zinc-900"><option value="">全部</option><option value="PENDING_SALES_MANAGER">等待销售经理</option><option value="PENDING_FINANCE">等待财务</option><option value="PENDING_ADMIN">等待管理员</option><option value="APPROVED">审核通过</option><option value="REJECTED">审核拒绝</option></select></th>
              <th className="px-2 py-2"><select name="status" defaultValue={params.status || "ALL"} className="h-9 w-28 rounded-lg border bg-white px-2 text-xs font-normal text-zinc-900"><option value="ALL">全部</option><option value="PROCESSING">处理中</option><option value="COMPLETED">已完成</option></select></th>
              <th className="px-2 py-2"><div className="grid gap-1"><PeriodFilterFields prefix="created" label="" params={params} /></div></th>
              {invoiceApplicantId && <th className="px-2 py-2 text-xs font-normal text-zinc-400">—</th>}
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
                    {(x.salesUserId === invoiceApplicantId || x.customerCollaboratorIds?.includes(invoiceApplicantId)) &&
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
