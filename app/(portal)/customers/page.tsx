import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { CustomerManager } from "@/components/customer-manager";
import { canViewAllCustomers, hasSalesCapabilities } from "@/lib/customer-access";
import { CustomerFilters } from "@/components/customer-filters";
import { DataImportExport } from "@/components/data-import-export";
import { Pagination } from "@/components/pagination";
import { cachedSalesUsers } from "@/lib/cached-data";
import { customerWhere } from "@/lib/customer-query";

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
  const where = customerWhere(user, params);
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
    cachedSalesUsers(),
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
        params={params}
      />
      {!items.length && <Empty text={q ? "没有匹配的客户" : "暂无客户"} />}
      <Pagination pathname="/customers" params={params} page={page} pageSize={pageSize} total={total} />
    </>
  );
}
