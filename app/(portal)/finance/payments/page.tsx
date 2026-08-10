import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentForm } from "@/components/order-actions";
import { SearchForm } from "@/components/search-form";
import { money } from "@/lib/utils";

export default async function Payments({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission("payment:manage");
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const items = await db.order.findMany({
    where: {
      approvalStatus: "APPROVED",
      status: { not: "CANCELLED" },
      paymentStatus: { not: "COMPLETED" },
      AND: [
        {
          OR: [
            { receivable: { isNot: null } },
            {
              invoiceStatus: "COMPLETED",
              paymentStatus: { in: ["PENDING", "PARTIAL"] },
            },
          ],
        },
        ...(q
          ? [{
              OR: [
              { orderNumber: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              { customer: { name: { contains: q, mode: "insensitive" as const } } },
              { salesUser: { name: { contains: q, mode: "insensitive" as const } } },
              {
                receivable: {
                  number: { contains: q, mode: "insensitive" as const },
                },
              },
              ],
            }]
          : []),
      ],
    },
    include: {
      customer: true,
      salesUser: true,
      receivable: { include: { responsibleUser: true } },
    },
    orderBy: { receivable: { expectedDate: "asc" } },
    take: 300,
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <>
      <PageHeader
        title="回款待办"
        description="预计日期已过且尚未足额回款的客户会自动标红提示逾期"
      />
      <SearchForm
        defaultValue={q}
        placeholder="搜索应收编号、订单号、订单名称、客户或销售人员"
        clearHref="/finance/payments"
      />
      {items.length ? (
        <div className="space-y-4">
          {items.map((order) => {
            const receivable = order.receivable;
            const total = Number(receivable?.amount || order.amount);
            const remaining = total - Number(order.paidAmount);
            const overdue = Boolean(
              receivable && receivable.expectedDate < today && remaining > 0,
            );
            const canRecord = order.invoiceStatus === "COMPLETED";
            return (
              <Card
                key={order.id}
                className={`grid gap-5 lg:grid-cols-[1fr_360px] ${
                  overdue ? "border-red-400 bg-red-50/30" : ""
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/orders/${order.id}`}
                      className="font-medium hover:underline"
                    >
                      {receivable?.number || order.orderNumber} · {order.name}
                    </a>
                    {overdue && (
                      <Badge className="bg-red-100 text-red-700">客户逾期</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    订单号：{order.orderNumber} · 客户：{order.customer.name} ·
                    销售：{order.salesUser.name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    应收金额：{money(total)} · 已回款：
                    {money(Number(order.paidAmount))} · 剩余：{money(remaining)}
                  </p>
                  {receivable && (
                    <p className={overdue ? "mt-1 text-sm font-medium text-red-600" : "mt-1 text-sm text-zinc-500"}>
                      预计回款日期：
                      {receivable.expectedDate.toLocaleDateString("zh-CN")} ·
                      负责人：{receivable.responsibleUser.name}
                    </p>
                  )}
                  {receivable?.remark && (
                    <p className="mt-2 text-sm text-zinc-500">
                      备注：{receivable.remark}
                    </p>
                  )}
                </div>
                {canRecord ? (
                  <PaymentForm id={order.id} remaining={remaining} />
                ) : (
                  <div className="rounded-lg bg-zinc-100 p-4 text-sm text-zinc-500">
                    等待销售提交开票申请并由财务完成发票处理后，即可登记回款。
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty text={q ? "没有匹配的回款待办" : "暂无回款待办"} />
      )}
    </>
  );
}
