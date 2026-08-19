import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money, dateTime } from "@/lib/utils";
import { DraftOrderActions } from "@/components/order-actions";

export default async function DraftOrders() {
  const user = await requireUser();
  const items = await db.order.findMany({
    where: { salesUserId: user.id, approvalStatus: "DRAFT" },
    select: {
      id: true,
      orderNumber: true,
      name: true,
      amount: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <>
      <PageHeader title="草稿箱" description="仅显示由你负责的未提交订单草稿" />
      {items.length ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr><th className="px-4 py-3">订单号</th><th className="px-4 py-3">订单名称</th><th className="px-4 py-3">客户</th><th className="px-4 py-3">金额</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">更新时间</th><th className="px-4 py-3">操作</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-4"><Link href={`/orders/${item.id}`} className="underline">{item.orderNumber || "草稿订单"}</Link></td>
                    <td className="px-4">{item.name}</td>
                    <td className="px-4">{item.customer.name}</td>
                    <td className="px-4">{money(Number(item.amount))}</td>
                    <td className="px-4"><Badge>草稿</Badge></td>
                    <td className="px-4 text-zinc-500">{dateTime(item.createdAt)}</td>
                    <td className="px-4"><DraftOrderActions id={item.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : <Empty text="暂无订单草稿" />}
    </>
  );
}
