import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { Card } from "@/components/ui/card";
import { InvoiceForm } from "@/components/order-actions";
import { SearchForm } from "@/components/search-form";
import { money } from "@/lib/utils";
export default async function Invoices({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission("invoice:manage");
  const params = await searchParams,
    q = params.q?.trim() || "",
    items = await db.order.findMany({
      where: {
        historicalSalesName: null,
        approvalStatus: "APPROVED",
        invoiceApplicationStatus: "COMPLETED",
        invoiceStatus: "PENDING",
        ...(q
          ? {
              OR: [
                { orderNumber: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { customer: { name: { contains: q, mode: "insensitive" } } },
                { salesUser: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { customer: true, salesUser: true },
      orderBy: { approvedAt: "asc" },
      take: 300,
    });
  return (
    <>
      <PageHeader
        title="发票待办"
        description="销售上传开票信息并提交申请后进入财务处理"
      />
      <SearchForm
        defaultValue={q}
        placeholder="搜索订单号、订单名称、客户或销售人员"
        clearHref="/finance/invoices"
      />
      {items.length ? (
        <div className="space-y-4">
          {items.map((x) => (
            <Card key={x.id} className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <div>
                <a
                  href={`/orders/${x.id}`}
                  className="font-medium hover:underline"
                >
                  {x.orderNumber} · {x.name}
                </a>
                <p className="mt-2 text-sm text-zinc-500">
                  客户：{x.customer.name} · 销售：{x.salesUser.name}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  订单金额：{money(Number(x.amount))}
                </p>
                {x.invoiceApplicationFileUrl && (
                  <a
                    href={x.invoiceApplicationFileUrl}
                    target="_blank"
                    className="mt-2 inline-block text-sm underline"
                  >
                    查看开票信息
                  </a>
                )}
                {x.invoiceApplicationNote && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-500">
                    开票内容：{x.invoiceApplicationNote}
                  </p>
                )}
              </div>
              <InvoiceForm id={x.id} />
            </Card>
          ))}
        </div>
      ) : (
        <Empty text={q ? "没有匹配的发票待办" : "暂无发票待办"} />
      )}
    </>
  );
}
