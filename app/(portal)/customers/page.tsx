import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { CustomerManager } from "@/components/customer-manager";
import { SearchForm } from "@/components/search-form";
import Link from "next/link";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; q?: string; type?: string }>;
}) {
  const user = await requirePermission("customer:view"),
    params = await searchParams,
    q = params.q?.trim() || "",
    type =
      params.type === "WON"
        ? "WON"
        : params.type === "POTENTIAL"
          ? "POTENTIAL"
          : "ALL";
  const searchWhere = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { contact: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { address: { contains: q, mode: "insensitive" as const } },
            { contactInfo: { contains: q, mode: "insensitive" as const } },
            { owner: { name: { contains: q, mode: "insensitive" as const } } },
            {
              activities: {
                some: {
                  content: { contains: q, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {},
    typeWhere =
      type === "WON"
        ? { orders: { some: { approvalStatus: "APPROVED" as const } } }
        : type === "POTENTIAL"
          ? { orders: { none: { approvalStatus: "APPROVED" as const } } }
          : {};
  const [items, salesUsers] = await Promise.all([
    db.customer.findMany({
      where: { ...searchWhere, ...typeWhere },
      include: {
        owner: { select: { id: true, name: true } },
        activities: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        orders: {
          where: { approvalStatus: "APPROVED" },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    user.role.code === "ADMIN"
      ? db.user.findMany({
          where: {
            status: "ACTIVE",
            role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } },
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const mappedItems = items.map(({ orders, ...item }) => ({
    ...item,
    customerType: orders.length ? ("WON" as const) : ("POTENTIAL" as const),
  }));
  const canCreate =
      user.role.code.startsWith("SALES") || user.role.code === "ADMIN",
    clearHref = params.return
      ? `/customers?return=${encodeURIComponent(params.return)}`
      : "/customers";
  return (
    <>
      <PageHeader
        title="客户管理"
        description="所有人可查看客户资料和流水，只有负责销售可添加流水"
      />
      <SearchForm
        defaultValue={q}
        placeholder="搜索客户、联系人、电话、负责销售或流水内容"
        hidden={{ return: params.return, type }}
        clearHref={clearHref}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["ALL", "全部客户"],
          ["WON", "成交客户"],
          ["POTENTIAL", "潜在客户"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/customers?type=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-lg px-4 py-2 text-sm ${type === value ? "bg-zinc-950 text-white" : "border bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <CustomerManager
        items={mappedItems}
        canCreate={canCreate}
        currentUserId={user.id}
        salesUsers={salesUsers}
        returnTo={params.return}
      />
      {!mappedItems.length && (
        <Empty text={q ? "没有匹配的客户" : "暂无客户"} />
      )}
    </>
  );
}
