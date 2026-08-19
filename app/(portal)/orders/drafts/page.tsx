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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/orders/${item.id}`} className="text-lg font-semibold underline-offset-4 hover:underline">{item.orderNumber || "草稿订单"}</Link>
                <Badge>草稿</Badge>
              </div>
              <p className="text-base">{item.name}</p>
              <p className="text-sm text-zinc-500">客户：{item.customer.name}</p>
              <p className="text-sm text-zinc-500">金额：{money(Number(item.amount))}</p>
              <p className="text-sm text-zinc-500">保存于：{dateTime(item.createdAt)}</p>
              <div className="border-t pt-3"><DraftOrderActions id={item.id} /></div>
            </Card>
          ))}
        </div>
      ) : <Empty text="暂无订单草稿" />}
    </>
  );
}
