import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page";
import { NewOrderForm } from "@/components/new-order-form";
export default async function NewOrder({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const user = await requirePermission("order:create");
  const params = await searchParams;
  const [customers, staff] = await Promise.all([
    db.customer.findMany({
      where: {
        isPublicPool: false,
        OR: [
          { ownerId: user.id },
          { collaborators: { some: { userId: user.id } } },
        ],
      },
      select: {
        id: true,
        name: true,
        contact: true,
        phone: true,
        address: true,
        contactInfo: true,
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        department: { select: { code: true, name: true } },
        role: { select: { code: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="新建订单"
        description="选择客户、填写项目需求、上传合同后提交审核"
      />
      <NewOrderForm
        customers={customers}
        staff={staff}
        employeeNumber={user.employeeNumber}
        currentUserId={user.id}
        initialCustomerId={params.customerId}
      />
    </>
  );
}
