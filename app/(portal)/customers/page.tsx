import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { CustomerManager } from "@/components/customer-manager";
import { SearchForm } from "@/components/search-form";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; q?: string }>;
}) {
  const user = await requirePermission("customer:view"),
    params = await searchParams,
    q = params.q?.trim() || "";
  const [items, salesUsers] = await Promise.all([
    db.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contact: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { address: { contains: q, mode: "insensitive" } },
              { contactInfo: { contains: q, mode: "insensitive" } },
              { owner: { name: { contains: q, mode: "insensitive" } } },
              {
                activities: {
                  some: { content: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          }
        : undefined,
      include: {
        owner: { select: { id: true, name: true } },
        activities: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
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
        hidden={{ return: params.return }}
        clearHref={clearHref}
      />
      <CustomerManager
        items={items}
        canCreate={canCreate}
        currentUserId={user.id}
        salesUsers={salesUsers}
        returnTo={params.return}
      />
      {!items.length && <Empty text={q ? "没有匹配的客户" : "暂无客户"} />}
    </>
  );
}
