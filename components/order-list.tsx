import Link from "next/link";
import { Badge } from "./ui/badge";
import { money, dateTime } from "@/lib/utils";
import {
  approvalStatusText,
  businessOrderStatus,
  isOrderCompleted,
} from "@/lib/order-workflow";
import { CustomerCollaboratorPicker } from "./customer-collaborator-picker";
type Item = {
  id: string;
  salesUserId: string;
  orderNumber: string | null;
  name: string;
  amount: unknown;
  approvalStatus: string;
  invoiceStatus: string;
  invoiceApplicationStatus: string;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  customer: { id: string; name: string };
  customerCollaboratorIds?: string[];
  salesUser: { name: string };
};
export function OrderList({
  items,
  statusFilter,
  query,
  invoiceApplicantId,
  salesUsers = [],
}: {
  items: Item[];
  statusFilter: "ALL" | "PROCESSING" | "COMPLETED";
  query?: string;
  invoiceApplicantId?: string;
  salesUsers?: { id: string; name: string }[];
}) {
  const suffix = query ? `&q=${encodeURIComponent(query)}` : "";
  return (
    <>
      <div className="mb-4 flex gap-2">
        <Link
          href={`/orders?status=ALL${suffix}`}
          className={`rounded-lg px-3 py-2 text-sm ${statusFilter === "ALL" ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}
        >
          全部
        </Link>
        <Link
          href={`/orders?status=PROCESSING${suffix}`}
          className={`rounded-lg px-3 py-2 text-sm ${statusFilter === "PROCESSING" ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}
        >
          处理中
        </Link>
        <Link
          href={`/orders?status=COMPLETED${suffix}`}
          className={`rounded-lg px-3 py-2 text-sm ${statusFilter === "COMPLETED" ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}
        >
          已完成
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[1180px] whitespace-nowrap text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              {[
                "订单号",
                "订单名称",
                "客户",
                "销售人员",
                "金额",
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
                <td className="px-4">{x.salesUser.name}</td>
                <td className="px-4">{money(Number(x.amount))}</td>
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
                    {x.salesUserId === invoiceApplicantId && (
                      <div className="mt-2">
                        <CustomerCollaboratorPicker
                          customerId={x.customer.id}
                          salesUsers={salesUsers.filter((item) => item.id !== invoiceApplicantId)}
                          initialIds={x.customerCollaboratorIds || []}
                        />
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
