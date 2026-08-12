import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { CustomerManager } from "@/components/customer-manager";
import { canViewAllCustomers, customerAccessWhere } from "@/lib/customer-access";
import { CustomerFilters } from "@/components/customer-filters";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("customer:view");
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const access = customerAccessWhere(user);
  const now = new Date();
  const todayStart = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) + "T00:00:00+08:00");
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const filters = {
    status: params.customerStatus,
    nature: params.nature,
    ownerId: params.ownerId,
    businessLine: params.businessLine,
    industry: params.industry,
    createdFrom: params.createdFrom,
    createdTo: params.createdTo,
    updatedFrom: params.updatedFrom,
    updatedTo: params.updatedTo,
  };
  const where = {
    AND: [
      access,
      params.quick === "today" ? { createdAt: { gte: todayStart } } : params.quick === "week" ? { createdAt: { gte: weekStart } } : params.quick === "mine" ? { ownerId: user.id } : params.quick === "collaborative" ? { collaborators: { some: { userId: user.id } } } : {},
      q ? { OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { contact: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q } },
        { industry: { contains: q, mode: "insensitive" as const } },
        { contactInfo: { contains: q, mode: "insensitive" as const } },
        { owner: { name: { contains: q, mode: "insensitive" as const } } },
        { collaborators: { some: { user: { name: { contains: q, mode: "insensitive" as const } } } } },
        { contactMethods: { some: { value: { contains: q, mode: "insensitive" as const } } } },
      ] } : {},
      filters.status ? { status: filters.status as "POTENTIAL" | "INITIAL_CONTACT" | "FOLLOWING" | "WON" | "LOYAL" } : {},
      filters.nature ? { nature: { contains: filters.nature, mode: "insensitive" as const } } : {},
      filters.ownerId ? { OR: [{ ownerId: filters.ownerId }, { collaborators: { some: { userId: filters.ownerId } } }] } : {},
      filters.businessLine ? { businessLine: filters.businessLine as "ENVIRONMENTAL_MONITORING" | "PUBLIC_HEALTH" } : {},
      filters.industry ? { industry: { contains: filters.industry, mode: "insensitive" as const } } : {},
      filters.createdFrom || filters.createdTo ? { createdAt: { ...(filters.createdFrom ? { gte: new Date(`${filters.createdFrom}T00:00:00+08:00`) } : {}), ...(filters.createdTo ? { lte: new Date(`${filters.createdTo}T23:59:59+08:00`) } : {}) } } : {},
      filters.updatedFrom || filters.updatedTo ? { updatedAt: { ...(filters.updatedFrom ? { gte: new Date(`${filters.updatedFrom}T00:00:00+08:00`) } : {}), ...(filters.updatedTo ? { lte: new Date(`${filters.updatedTo}T23:59:59+08:00`) } : {}) } } : {},
    ],
  };
  const [items, salesUsers] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        collaborators: { include: { user: { select: { id: true, name: true } } } },
        contactMethods: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    db.user.findMany({
      where: { status: "ACTIVE", role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canAll = canViewAllCustomers(user.role.code);
  const canCreate = user.role.code.startsWith("SALES") || user.role.code === "ADMIN";
  return (
    <>
      <PageHeader
        title="客户管理"
        description={canAll ? "查看全部客户；客户资料仅负责人和客户协同跟进人可修改" : "仅显示您负责或协同跟进的客户"}
      />
      <CustomerFilters params={params} salesUsers={salesUsers} canCreate={canCreate} />
      <CustomerManager
        items={items}
        currentUserId={user.id}
        salesUsers={salesUsers}
        canAssignOwner={user.role.code === "ADMIN" || user.role.code === "SALES_MANAGER"}
        returnTo={params.return}
      />
      {!items.length && <Empty text={q ? "没有匹配的客户" : "暂无客户"} />}
    </>
  );
}
