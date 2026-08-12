import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { saveUpload } from "@/lib/uploads";
import { contractFileTypes, orderFormSchema } from "@/lib/order-input";

export const runtime = "nodejs";
const rejectedStatuses = [
  "MANAGER_REJECTED",
  "FINANCE_REJECTED",
  "ADMIN_REJECTED",
] as const;
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await requireUser(),
      { id } = await params,
      order = await db.order.findUnique({
        where: { id },
        include: {
          customer: { include: { collaborators: { select: { userId: true } } } },
          contract: true,
          salesUser: { select: { id: true, name: true, departmentId: true } },
          invoice: true,
          payments: true,
          approvals: true,
        },
      });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    const allowed =
      u.role.code === "ADMIN" ||
      u.role.code.startsWith("FINANCE") ||
      (u.role.code === "TECH_MANAGER" && order.approvalStatus === "APPROVED") ||
      (u.role.code === "TECH_EMPLOYEE" && order.technicalUserId === u.id) ||
      (u.role.code === "SALES_EMPLOYEE" && (order.salesUserId === u.id || order.customer.collaborators.some((item) => item.userId === u.id))) ||
      (u.role.code === "SALES_MANAGER" &&
        order.salesUser.departmentId === u.departmentId);
    if (!allowed) throw new Error("FORBIDDEN");
    return ok(order);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!user.role.code.startsWith("SALES")) throw new Error("FORBIDDEN");
    const order = await db.order.findUnique({
      where: { id },
      include: { contract: true, receivable: true, customer: { include: { collaborators: { select: { userId: true } } } } },
    });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    const canOperate = order.salesUserId === user.id || order.customer.collaborators.some((item) => item.userId === user.id);
    if (!canOperate) throw new Error("FORBIDDEN");
    if (
      !rejectedStatuses.includes(
        order.approvalStatus as (typeof rejectedStatuses)[number],
      ) ||
      order.status === "CANCELLED"
    )
      return fail("只有被拒绝的订单可以修改", "INVALID_STATE", 409);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("订单文件过大或表单格式无效", "INVALID_MULTIPART", 400);
    }
    const parsed = orderFormSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success)
      return fail(parsed.error.issues[0].message, "VALIDATION_ERROR");
    const data = parsed.data;
    const customer = await db.customer.findUnique({ where: { id: data.customerId }, include: { collaborators: { select: { userId: true } } } });
    if (!customer) return fail("客户不存在", "CUSTOMER_NOT_FOUND", 404);
    if (customer.ownerId !== user.id && !customer.collaborators.some((item) => item.userId === user.id))
      throw new Error("FORBIDDEN");
    const staffIds = [
      data.signerId,
      data.responsibleUserId,
      data.collaboratorId,
      data.receivableResponsibleUserId,
      ...(data.receivableCollaboratorUserId
        ? [data.receivableCollaboratorUserId]
        : []),
    ];
    const staffCount = await db.user.count({
      where: { id: { in: [...new Set(staffIds)] }, status: "ACTIVE" },
    });
    if (staffCount !== new Set(staffIds).size)
      return fail("所选负责人或协同人不存在或已停用", "INVALID_STAFF", 400);
    const financeCollaborator = await db.user.findFirst({
      where: {
        id: data.collaboratorId,
        status: "ACTIVE",
        OR: [
          { department: { code: "FINANCE" } },
          { role: { code: { in: ["FINANCE_MANAGER", "FINANCE_EMPLOYEE"] } } },
        ],
      },
      select: { id: true },
    });
    if (!financeCollaborator)
      return fail("订单协同人只能选择财务人员", "INVALID_CONTRACT_COLLABORATOR", 400);

    const uploaded = form.get("contract");
    let fileData: {
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
    } = {};
    if (uploaded instanceof File && uploaded.size) {
      if (!contractFileTypes.has(uploaded.type))
        return fail("合同仅支持 PDF、Word、JPG、PNG、WEBP", "INVALID_FILE_TYPE");
      if (uploaded.size > 10 * 1024 * 1024)
        return fail("合同文件不能超过 10MB", "FILE_TOO_LARGE");
      fileData = {
        fileUrl: await saveUpload(uploaded, {
          prefix: "contract",
          subdirectory: "contracts",
          types: contractFileTypes,
          maxBytes: 10 * 1024 * 1024,
        }),
        fileName: uploaded.name,
        fileSize: uploaded.size,
        fileType: uploaded.type,
      };
    }

    const managerCreated = user.role.code === "SALES_MANAGER";
    const approvalStatus = managerCreated
      ? ("PENDING_FINANCE" as const)
      : ("PENDING_SALES_MANAGER" as const);
    const reviewFee = data.reviewFee || 0;
    const otherExpense = data.otherExpense || 0;
    const netOrderAmount =
      data.amount -
      data.technicalSupportFee -
      data.outsourcingFee -
      reviewFee -
      otherExpense;

    const updated = await db.$transaction(
      async (tx) => {
        await tx.contract.update({
          where: { id: order.contractId },
          data: {
            name: `${data.name}合同`,
            businessType: data.businessType,
            signingStatus: data.signingStatus,
            customerId: customer.id,
            signerId: data.signerId,
            responsibleUserId: data.responsibleUserId,
            collaboratorId: data.collaboratorId,
            productTotal: data.productTotal,
            amount: data.amount,
            dealPrice: data.amount,
            technicalSupportFee: data.technicalSupportFee,
            outsourcingFee: data.outsourcingFee,
            reviewFee,
            otherExpense,
            netOrderAmount,
            adjustedNetAmount: data.adjustedNetAmount,
            expenseDetails: data.expenseDetails,
            originalExpenseNote: data.originalExpenseNote,
            contractDate: data.contractDate,
            status: "SUBMITTED",
            ...fileData,
          },
        });
        const item = await tx.order.update({
          where: { id },
          data: {
            customerId: customer.id,
            name: data.name,
            contact: customer.contact,
            phone: customer.phone,
            address: customer.address,
            contactInfo: customer.contactInfo,
            amount: data.amount,
            projectRequirements: data.projectRequirements,
            remark: data.remark,
            approvalStatus,
            status: approvalStatus,
          },
        });
        await tx.receivable.upsert({
          where: { orderId: id },
          update: {
            amount: data.receivableAmount,
            expectedDate: data.receivableExpectedDate,
            paymentType: data.receivablePaymentType,
            remark: data.receivableRemark,
            responsibleUserId: data.receivableResponsibleUserId,
            collaboratorUserId: data.receivableCollaboratorUserId,
          },
          create: {
            orderId: id,
            number: `PMO.${order.contract.contractNumber}`,
            amount: data.receivableAmount,
            expectedDate: data.receivableExpectedDate,
            paymentType: data.receivablePaymentType,
            remark: data.receivableRemark,
            responsibleUserId: data.receivableResponsibleUserId,
            collaboratorUserId: data.receivableCollaboratorUserId,
          },
        });
        const recipients = managerCreated
          ? await tx.user.findMany({
              where: { department: { code: "FINANCE" }, status: "ACTIVE" },
              select: { id: true },
            })
          : await tx.user.findMany({
              where: {
                role: { code: "SALES_MANAGER" },
                departmentId: user.departmentId,
                status: "ACTIVE",
              },
              select: { id: true },
            });
        if (recipients.length)
          await tx.notification.createMany({
            data: recipients.map((recipient) => ({
              userId: recipient.id,
              type: "APPROVAL" as const,
              title: "被拒订单已修改并重新提交",
              content: item.name,
              targetId: item.id,
            })),
          });
        await tx.operationLog.create({
          data: {
            userId: user.id,
            action: "RESUBMIT_ORDER",
            module: "ORDER",
            targetId: id,
            description: `修改被拒订单“${item.name}”并重新提交审核`,
          },
        });
        return item;
      },
      { maxWait: 5000, timeout: 15000 },
    );
    return ok(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!user.role.code.startsWith("SALES")) throw new Error("FORBIDDEN");
    const order = await db.order.findUnique({ where: { id } });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    const customer = await db.customer.findUnique({ where: { id: order.customerId }, include: { collaborators: { select: { userId: true } } } });
    if (!customer || (order.salesUserId !== user.id && !customer.collaborators.some((item) => item.userId === user.id)))
      throw new Error("FORBIDDEN");
    if (
      !rejectedStatuses.includes(
        order.approvalStatus as (typeof rejectedStatuses)[number],
      ) ||
      order.status === "CANCELLED"
    )
      return fail("只有被拒绝的订单可以取消", "INVALID_STATE", 409);
    await db.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
      await tx.contract.update({
        where: { id: order.contractId },
        data: { status: "CANCELLED" },
      });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "CANCEL_ORDER",
          module: "ORDER",
          targetId: id,
          description: `销售取消被拒订单“${order.name}”`,
        },
      });
    });
    return ok({ id, status: "CANCELLED" });
  } catch (error) {
    return apiError(error);
  }
}
