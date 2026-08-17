import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { CustomerManager } from "@/components/customer-manager";
import { canViewAllCustomers, customerAccessWhere, hasSalesCapabilities } from "@/lib/customer-access";
import { CustomerFilters } from "@/components/customer-filters";
import { DataImportExport } from "@/components/data-import-export";
import { Pagination } from "@/components/pagination";
import { periodRange } from "@/lib/period-range";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("customer:view");
  const params = await searchParams;
  const pageSize = 25;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() || "";
  const access = customerAccessWhere(user);
  const now = new Date();
  const todayStart = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) + "T00:00:00+08:00");
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const filters = {
    ownership: params.ownership,
    category: params.category,
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
  const createdRange = periodRange("date", filters.createdFrom, filters.createdTo);
  const updatedRange = periodRange("date", filters.updatedFrom, filters.updatedTo);
  const createdTimeWhere = createdRange ? { createdAt: createdRange } : {};
  const updatedTimeWhere = updatedRange ? { updatedAt: updatedRange } : {};
  const where = {
    AND: [
      access,
      filters.category ? { category: filters.category as "XINYAO_ENVIRONMENT" | "OCCUPATIONAL_HEALTH" } : {},
      filters.ownership === "PUBLIC" ? { isPublicPool: true } : filters.ownership === "TRACKED" ? { isPublicPool: false } : {},
      params.quick === "today" ? { createdAt: { gte: todayStart } } : params.quick === "week" ? { createdAt: { gte: weekStart } } : params.quick === "mine" ? { isPublicPool: false, ownerId: user.id } : params.quick === "collaborative" ? { isPublicPool: false, collaborators: { some: { userId: user.id } } } : params.quick === "public" ? { isPublicPool: true } : {},
      q ? { OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { contact: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q } },
        { industry: { contains: q, mode: "insensitive" as const } },
        { contactInfo: { contains: q, mode: "insensitive" as const } },
        { pendingOwnerName: { contains: q, mode: "insensitive" as const } },
        { owner: { is: { name: { contains: q, mode: "insensitive" as const } } } },
        { collaborators: { some: { user: { name: { contains: q, mode: "insensitive" as const } } } } },
        { contactMethods: { some: { value: { contains: q, mode: "insensitive" as const } } } },
      ] } : {},
      filters.status ? { status: filters.status as "POTENTIAL" | "INITIAL_CONTACT" | "FOLLOWING" | "WON" | "LOYAL" } : {},
      filters.nature ? { nature: { contains: filters.nature, mode: "insensitive" as const } } : {},
      filters.ownerId ? { OR: [{ ownerId: filters.ownerId }, { collaborators: { some: { userId: filters.ownerId } } }] } : {},
      filters.businessLine ? { businessLine: filters.businessLine as "ENVIRONMENTAL_MONITORING" | "PUBLIC_HEALTH" | "OCCUPATIONAL_HEALTH" } : {},
      filters.industry ? { industry: { contains: filters.industry, mode: "insensitive" as const } } : {},
      createdTimeWhere,
      updatedTimeWhere,
    ],
  };
  const [items, total, salesUsers] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        collaborators: { include: { user: { select: { id: true, name: true } } } },
        contactMethods: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.customer.count({ where }),
    db.user.findMany({
      where: { status: "ACTIVE", role: { code: { in: ["ADMIN", "SALES_MANAGER", "SALES_EMPLOYEE"] } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canAll = canViewAllCustomers(user.role.code);
  const canCreate = hasSalesCapabilities(user.role.code);
  return (
    <>
      <PageHeader
        title="客户管理"
        description={canAll ? "查看全部客户；客户资料仅负责人和客户协同跟进人可修改" : "仅显示您负责或协同跟进的客户"}
      />
      <CustomerFilters params={params} salesUsers={salesUsers} canCreate={canCreate} showPublicPool={hasSalesCapabilities(user.role.code) || user.role.code.startsWith("FINANCE") || user.role.code === "ADMIN"} />
      <DataImportExport entity="customers" canImport={canCreate} hideToolbar />
      <CustomerManager
        items={items}
        currentUserId={user.id}
        salesUsers={salesUsers}
        canAssignOwner={user.role.code === "ADMIN" || user.role.code === "SALES_MANAGER"}
        canClaimPublic={hasSalesCapabilities(user.role.code)}
        returnTo={params.return}
      />
      {!items.length && <Empty text={q ? "没有匹配的客户" : "暂无客户"} />}
      <Pagination pathname="/customers" params={params} page={page} pageSize={pageSize} total={total} />
    </>
  );
}
