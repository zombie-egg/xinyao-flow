import { hasSalesCapabilities } from "@/lib/customer-access";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page";
import { NewOrderForm, type OrderFormInitial } from "@/components/new-order-form";

const rejectedStatuses = [
  "MANAGER_REJECTED",
  "FINANCE_REJECTED",
  "ADMIN_REJECTED",
];

export default async function EditRejectedOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!hasSalesCapabilities(user.role.code)) throw new Error("FORBIDDEN");
  const [order, customers, staff] = await Promise.all([
    db.order.findUnique({
      where: { id },
      include: { contract: true, receivable: true, customer: { include: { collaborators: { select: { userId: true } } } } },
    }),
    db.customer.findMany({
      where: {
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
        category: true,
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
  if (!order) notFound();
  if (order.salesUserId !== user.id && !order.customer.collaborators.some((item) => item.userId === user.id))
    throw new Error("FORBIDDEN");
  if (!rejectedStatuses.includes(order.approvalStatus) || order.status === "CANCELLED")
    redirect(`/orders/${id}`);

  const initial: OrderFormInitial = {
    category: order.category,
    customerId: order.customerId,
    contractNumber: order.contract.contractNumber,
    businessType: order.contract.businessType,
    productTotal: Number(order.contract.productTotal),
    amount: Number(order.contract.amount),
    technicalSupportFee: Number(order.contract.technicalSupportFee),
    outsourcingFee: Number(order.contract.outsourcingFee),
    reviewFee: Number(order.contract.reviewFee),
    otherExpense: Number(order.contract.otherExpense),
    adjustedNetAmount:
      order.contract.adjustedNetAmount == null
        ? null
        : Number(order.contract.adjustedNetAmount),
    expenseDetails: order.contract.expenseDetails,
    originalExpenseNote: order.contract.originalExpenseNote,
    name: order.name,
    signingStatus: order.contract.signingStatus,
    contractDate: order.contract.contractDate.toLocaleDateString("en-CA", {
      timeZone: "Asia/Shanghai",
    }),
    signerId: order.contract.signerId,
    responsibleUserId: order.contract.responsibleUserId,
    collaboratorId: order.contract.collaboratorId,
    projectRequirements: order.projectRequirements,
    remark: order.remark,
    receivable: order.receivable
      ? {
          number: order.receivable.number,
          amount: Number(order.receivable.amount),
          expectedDate: order.receivable.expectedDate.toLocaleDateString(
            "en-CA",
            { timeZone: "Asia/Shanghai" },
          ),
          paymentType: order.receivable.paymentType,
          remark: order.receivable.remark,
          responsibleUserId: order.receivable.responsibleUserId,
          collaboratorUserId: order.receivable.collaboratorUserId,
        }
      : null,
  };
  return (
    <>
      <PageHeader
        title="修改被拒订单"
        description="修改完成后将重新进入原有合同审核流程，历史审批记录会保留"
      />
      <NewOrderForm
        customers={customers}
        staff={staff}
        currentUserId={user.id}
        orderId={id}
        initial={initial}
      />
    </>
  );
}
