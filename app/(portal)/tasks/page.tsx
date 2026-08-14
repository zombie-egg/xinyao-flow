import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { Card } from "@/components/ui/card";
import { AssignTechnical, TechnicalActions } from "@/components/order-actions";
import { SearchForm } from "@/components/search-form";
import { technicalStatusText } from "@/lib/order-workflow";
import { Badge } from "@/components/ui/badge";

export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePermission("order:tech");
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const manager = user.role.code === "TECH_MANAGER";
  const baseWhere = manager
    ? { historicalSalesName: null, approvalStatus: "APPROVED" as const }
    : { historicalSalesName: null, approvalStatus: "APPROVED" as const, technicalUserId: user.id };
  const where = {
    ...baseWhere,
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { customer: { name: { contains: q, mode: "insensitive" as const } } },
            { salesUser: { name: { contains: q, mode: "insensitive" as const } } },
            { technicalUser: { name: { contains: q, mode: "insensitive" as const } } },
            { projectRequirements: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, employees] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        customer: true,
        contract: true,
        salesUser: true,
        technicalUser: true,
      },
      orderBy: { approvedAt: "desc" },
      take: 500,
    }),
    manager
      ? db.user.findMany({
          where: {
            role: { code: "TECH_EMPLOYEE" },
            department: { code: "TECH" },
            status: "ACTIVE",
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        title={manager ? "技术总订单" : "我的订单任务"}
        description={
          manager
            ? "每个订单只能分配一次，分配后不能更换技术员工"
            : "仅显示技术经理分配给我的订单"
        }
      />
      <SearchForm
        defaultValue={q}
        placeholder="搜索订单号、订单、客户、销售、技术员工或项目需求"
        clearHref="/tasks"
      />
      {items.length ? (
        <div className="space-y-3">
          {items.map((order) => (
            <Card
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <a
                  href={`/orders/${order.id}`}
                  className="font-medium hover:underline"
                >
                  {order.orderNumber} · {order.name}
                </a>
                <p className="mt-1 text-sm text-zinc-500">
                  {order.customer.name} · {order.projectRequirements.slice(0, 80)}
                </p>
                <div className="mt-2 flex gap-2">
                  <Badge>{technicalStatusText[order.technicalStatus]}</Badge>
                  <Badge>
                    {order.technicalUser
                      ? `已分配：${order.technicalUser.name}`
                      : "尚未分配"}
                  </Badge>
                </div>
              </div>
              {manager ? (
                <AssignTechnical
                  id={order.id}
                  employees={employees}
                  currentId={order.technicalUserId}
                  currentName={order.technicalUser?.name}
                />
              ) : (
                <TechnicalActions
                  id={order.id}
                  status={order.technicalStatus}
                />
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          text={
            q
              ? "没有匹配的技术订单"
              : manager
                ? "暂无已审核订单"
                : "暂无分配给你的订单"
          }
        />
      )}
    </>
  );
}
