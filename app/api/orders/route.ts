import { hasSalesCapabilities } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { saveUpload } from "@/lib/uploads";
import { contractFileTypes, orderFormSchema } from "@/lib/order-input";
import { duplicateOrderNumberResponse, findOrderByNumber } from "@/lib/order-number";
export const runtime = "nodejs";
export async function GET() {
  try {
    const u = await requireUser();
    let where = {};
    if (u.role.code === "SALES_MANAGER")
      where = { salesUser: { departmentId: u.departmentId } };
    else if (u.role.code === "SALES_EMPLOYEE")
      where = {
        OR: [
          { salesUserId: u.id },
          { customer: { collaborators: { some: { userId: u.id } } } },
        ],
      };
    else if (u.role.code === "TECH_MANAGER")
      where = { approvalStatus: "APPROVED" as const };
    else if (u.role.code === "TECH_EMPLOYEE")
      where = { approvalStatus: "APPROVED" as const, technicalUserId: u.id };
    else if (!u.role.code.startsWith("FINANCE") && u.role.code !== "ADMIN")
      throw new Error("FORBIDDEN");
    return ok(
      await db.order.findMany({
        where,
        include: {
          customer: true,
          salesUser: { select: { name: true } },
          contract: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  let submittedContractNumber: string | undefined;
  try {
    const u = await requirePermission("order:create");
    if (!hasSalesCapabilities(u.role.code)) throw new Error("FORBIDDEN");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail(
        "订单文件过大或表单格式无效，请压缩文件后重试",
        "INVALID_MULTIPART",
        400,
      );
    }
    const p = orderFormSchema.safeParse(Object.fromEntries(form.entries()));
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    submittedContractNumber = p.data.contractNumber;
    const duplicate = await findOrderByNumber(p.data.contractNumber);
    if (duplicate) return duplicateOrderNumberResponse(duplicate);
    const file = form.get("contract");
    if (!(file instanceof File) || !file.size)
      return fail("请上传合同文件", "CONTRACT_REQUIRED");
    if (!contractFileTypes.has(file.type))
      return fail("合同仅支持 PDF、Word、JPG、PNG、WEBP", "INVALID_FILE_TYPE");
    if (file.size > 10 * 1024 * 1024)
      return fail("合同文件不能超过 10MB", "FILE_TOO_LARGE");
    const customer = await db.customer.findUnique({
      where: { id: p.data.customerId },
      include: {
        collaborators: { select: { userId: true } },
        owner: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            role: { select: { code: true } },
          },
        },
      },
    });
    if (!customer)
      return fail("客户不存在，请先创建客户", "CUSTOMER_NOT_FOUND", 404);
    if (customer.category !== p.data.category)
      return fail("订单归属与客户模板不一致，请重新选择客户", "CATEGORY_MISMATCH", 409);
    if (customer.isPublicPool || !customer.ownerId || !customer.owner)
      return fail("公海客户需要先认领并设置负责销售", "PUBLIC_CUSTOMER_MUST_BE_CLAIMED", 409);
    const canUseCustomer =
      customer.ownerId === u.id ||
      customer.collaborators.some((item) => item.userId === u.id);
    if (!canUseCustomer) throw new Error("FORBIDDEN");
    const staffIds = [
        u.id,
        p.data.collaboratorId,
        ...(p.data.receivableCollaboratorUserId
          ? [p.data.receivableCollaboratorUserId]
          : []),
      ],
      staffCount = await db.user.count({
        where: { id: { in: [...new Set(staffIds)] }, status: "ACTIVE" },
      });
    if (staffCount !== new Set(staffIds).size)
      return fail("所选负责人或协同人不存在或已停用", "INVALID_STAFF", 400);
    const financeCollaborator = await db.user.findFirst({
      where: {
        id: p.data.collaboratorId,
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
    const fileUrl = await saveUpload(file, {
      prefix: "contract",
      subdirectory: "contracts",
      types: contractFileTypes,
      maxBytes: 10 * 1024 * 1024,
      optimizeImage: true,
    });
    const managerCreated = u.role.code === "SALES_MANAGER" || u.role.code === "ADMIN",
      approvalStatus = managerCreated
        ? "PENDING_FINANCE"
        : "PENDING_SALES_MANAGER",
      status = managerCreated ? "PENDING_FINANCE" : "PENDING_SALES_MANAGER",
      reviewFee = p.data.reviewFee || 0,
      otherExpense = p.data.otherExpense || 0,
      netOrderAmount =
        p.data.amount -
        p.data.technicalSupportFee -
        p.data.outsourcingFee -
        reviewFee -
        otherExpense;
    const order = await db.$transaction(async (tx) => {
      const contractNumber = p.data.contractNumber;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-number-${contractNumber.toLowerCase()}`}))`;
      const duplicateInTransaction = await tx.order.findFirst({
        where: {
          OR: [
            { orderNumber: { equals: contractNumber, mode: "insensitive" } },
            { contract: { contractNumber: { equals: contractNumber, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
      });
      if (duplicateInTransaction) throw new Error("CONTRACT_NUMBER_EXISTS");
      const contract = await tx.contract.create({
        data: {
          name: `${p.data.name}合同`,
          contractNumber,
          businessType: p.data.businessType,
          signingStatus: p.data.signingStatus,
          customerId: customer.id,
          salesUserId: u.id,
          signerId: u.id,
          responsibleUserId: u.id,
          collaboratorId: p.data.collaboratorId,
          productTotal: p.data.productTotal ?? 0,
          amount: p.data.amount,
          dealPrice: p.data.amount,
          technicalSupportFee: p.data.technicalSupportFee,
          outsourcingFee: p.data.outsourcingFee,
          reviewFee,
          otherExpense,
          netOrderAmount,
          adjustedNetAmount: p.data.adjustedNetAmount,
          expenseDetails: p.data.expenseDetails,
          originalExpenseNote: p.data.originalExpenseNote,
          contractDate: p.data.contractDate,
          fileUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: "SUBMITTED",
        },
      });
      const item = await tx.order.create({
        data: {
          category: p.data.category,
          contractId: contract.id,
          orderNumber: contractNumber,
          customerId: customer.id,
          salesUserId: u.id,
          name: p.data.name,
          contact: customer.contact,
          phone: customer.phone,
          address: customer.address,
          contactInfo: customer.contactInfo,
          amount: p.data.amount,
          projectRequirements: p.data.projectRequirements ?? "",
          remark: p.data.remark,
          approvalStatus,
          status,
          invoiceStatus: "NOT_REQUIRED",
          paymentStatus: "NOT_REQUIRED",
        },
      });
      await tx.receivable.create({
        data: {
          orderId: item.id,
          number: `PMO.${contractNumber}`,
          amount: p.data.receivableAmount,
          expectedDate: p.data.receivableExpectedDate,
          paymentType: p.data.receivablePaymentType,
          remark: p.data.receivableRemark,
          responsibleUserId: u.id,
          collaboratorUserId: p.data.receivableCollaboratorUserId,
        },
      });
      await tx.operationLog.create({
        data: {
          userId: u.id,
          action: "SUBMIT_ORDER",
          module: "ORDER",
          targetId: item.id,
          description: `提交订单“${item.name}”审核，订单销售人员：${u.name}，客户：${customer.name}`,
        },
      });
      const recipients = managerCreated
        ? await tx.user.findMany({
            where: { department: { code: "FINANCE" }, status: "ACTIVE" },
          })
        : await tx.user.findMany({
            where: {
              role: { code: "SALES_MANAGER" },
              departmentId: u.departmentId,
              status: "ACTIVE",
            },
          });
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map((r) => ({
            userId: r.id,
            type: "APPROVAL" as const,
            title: "新订单待审核",
            content: `${u.name}提交了订单“${item.name}”`,
            targetId: item.id,
          })),
        });
      return item;
    }, { maxWait: 5000, timeout: 15000 });
    return ok(order, 201);
  } catch (e) {
    if (
      (e instanceof Error && e.message === "CONTRACT_NUMBER_EXISTS") ||
      (typeof e === "object" && e && "code" in e && String(e.code) === "P2002")
    ) {
      const existing = submittedContractNumber
        ? await findOrderByNumber(submittedContractNumber)
        : null;
      if (existing) return duplicateOrderNumberResponse(existing);
      return fail("已有该合同编号，请勿重复创建", "CONTRACT_NUMBER_EXISTS", 409);
    }
    return apiError(e);
  }
}
