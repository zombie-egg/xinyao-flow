import { hasSalesCapabilities } from "@/lib/customer-access";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { Card } from "@/components/ui/card";
import { SearchForm } from "@/components/search-form";
import { InvoiceApplicationForm } from "@/components/order-actions";
import { money } from "@/lib/utils";

export default async function InvoiceApplications({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  if (!hasSalesCapabilities(user.role.code)) throw new Error("FORBIDDEN");
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const orders = await db.order.findMany({
    where: {
      historicalSalesName: null,
      approvalStatus: "APPROVED",
      invoiceApplicationStatus: "PENDING",
      AND: [
        { OR: [
          { salesUserId: user.id },
          { customer: { collaborators: { some: { userId: user.id } } } },
        ] },
        ...(q
          ? [{ OR: [
              { orderNumber: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              {
                customer: {
                  name: { contains: q, mode: "insensitive" as const },
                },
              },
              {
                contract: {
                  contractNumber: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
              },
            ] }]
          : []),
      ],
    },
    include: { customer: true, contract: true },
    orderBy: { approvedAt: "asc" },
    take: 300,
  });
  return (
    <>
      <PageHeader
        title="开票申请"
        description="合同全部审核通过后，由负责销售上传开票资料并提交给财务"
      />
      <SearchForm
        defaultValue={q}
        placeholder="搜索订单号、合同编号、订单名称或客户"
        clearHref="/invoice-applications"
      />
      {orders.length ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              id={`order-${order.id}`}
              className="grid scroll-mt-6 gap-5 lg:grid-cols-[1fr_380px]"
            >
              <div className="min-w-0">
                <Link
                  href={`/orders/${order.id}`}
                  className="font-medium hover:underline"
                >
                  {order.orderNumber} · {order.name}
                </Link>
                <p className="mt-2 text-sm text-zinc-500">
                  合同编号：{order.contract.contractNumber || "—"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  客户：{order.customer.name}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  合同金额：{money(Number(order.amount))}
                </p>
              </div>
              <InvoiceApplicationForm id={order.id} />
            </Card>
          ))}
        </div>
      ) : (
        <Empty text={q ? "没有匹配的待申请订单" : "暂无待申请开票的订单"} />
      )}
    </>
  );
}
