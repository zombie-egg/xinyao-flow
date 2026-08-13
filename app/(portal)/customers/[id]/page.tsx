import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Empty } from "@/components/page";
import { CustomerActivityForm } from "@/components/customer-activity-form";
import { customerStatusText, businessLineText } from "@/lib/customer-labels";
import { customerAccessWhere, customerBusinessAccess } from "@/lib/customer-access";
import { money, dateTime } from "@/lib/utils";
import { businessOrderStatus } from "@/lib/order-workflow";
import { PublicCustomerClaim } from "@/components/public-customer-claim";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("customer:view");
  const { id } = await params;
  const [customer, salesUsers] = await Promise.all([
    db.customer.findFirst({
      where: { AND: [{ id }, customerAccessWhere(user)] },
      include: {
        owner: { select: { id: true, name: true } },
        collaborators: { include: { user: { select: { id: true, name: true } } } },
        contactMethods: true,
        activities: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 },
        orders: { include: { salesUser: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    user.role.code.startsWith("SALES")
      ? db.user.findMany({
          where: { status: "ACTIVE", role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  if (!customer) notFound();
  const canManageCustomer = user.role.code.startsWith("SALES") && customerBusinessAccess(customer, user.id);
  return (
    <>
      <PageHeader title={customer.name} description="客户资料、客户流水与历史订单明细" />
      <div className="mb-5 flex flex-wrap gap-2">{customer.isPublicPool && user.role.code.startsWith("SALES") ? <PublicCustomerClaim customerId={customer.id} salesUsers={salesUsers} /> : canManageCustomer && <Link href={`/orders/new?customerId=${customer.id}`} className="inline-flex h-10 items-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white">为该客户新建订单</Link>}<Link href="/customers" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm">返回客户管理</Link></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card><h2 className="font-medium">客户资料</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{[
          ["业务线", businessLineText[customer.businessLine]],
          ["环境检测类型", customer.monitoringType || "—"],
          ["客户行业", customer.industry || "—"],
          ["客户状态", customer.isPublicPool ? "公海客户" : customerStatusText[customer.status]],
          ["客户性质", customer.nature || "—"],
          ["联系人", customer.contact],
          ["联系电话", customer.phone],
          ["地址", customer.address || "—"],
          ["负责销售", customer.owner?.name || "公海池"],
          ["协同跟进人", customer.collaborators.map((item) => item.user.name).join("、") || "—"],
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-zinc-500">{label}</dt><dd className="text-right">{value}</dd></div>)}</dl>{customer.contactMethods.length > 0 && <div className="mt-4 border-t pt-4 text-sm"><p className="text-zinc-500">全部联系方式</p>{customer.contactMethods.map((item) => <p key={item.id} className="mt-2">{item.label || "其他"}：{item.value}</p>)}</div>}</Card>
        <Card><h2 className="font-medium">客户流水</h2>{canManageCustomer && <CustomerActivityForm customerId={customer.id} />}{customer.activities.length ? <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto">{customer.activities.map((item) => <div key={item.id} className="rounded-lg bg-zinc-50 p-3 text-sm"><p className="whitespace-pre-wrap">{item.content}</p><p className="mt-2 text-xs text-zinc-400">{item.author.name} · {dateTime(item.createdAt)}</p></div>)}</div> : <Empty text="暂无客户流水" />}</Card>
        <Card className="xl:col-span-2"><h2 className="font-medium">历史订单</h2>{customer.orders.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{customer.orders.map((order) => <Link key={order.id} href={`/orders/${order.id}`} className="rounded-xl border p-4 hover:bg-zinc-50"><div className="flex items-center justify-between gap-3"><p className="font-medium">{order.orderNumber || "待审核订单"}</p><Badge>{businessOrderStatus(order)}</Badge></div><p className="mt-2 text-sm">{order.name}</p><p className="mt-2 text-sm text-zinc-500">销售：{order.salesUser.name} · {money(Number(order.amount))}</p><p className="mt-1 text-sm text-zinc-500">订单成立日期：{order.createdAt.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</p></Link>)}</div> : <Empty text="该客户暂无订单" />}</Card>
      </div>
    </>
  );
}
