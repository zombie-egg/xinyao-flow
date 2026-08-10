import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { saveUpload } from "@/lib/uploads";
import { chinaDateNumber, documentNumber } from "@/lib/document-number";
import { contractFileTypes, orderFormSchema } from "@/lib/order-input";
export const runtime = "nodejs";
export async function GET() {
  try {
    const u = await requireUser();
    let where = {};
    if (u.role.code === "SALES_MANAGER")
      where = { salesUser: { departmentId: u.departmentId } };
    else if (u.role.code === "SALES_EMPLOYEE") where = { salesUserId: u.id };
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
  try {
    const u = await requirePermission("order:create");
    if (!u.role.code.startsWith("SALES")) throw new Error("FORBIDDEN");
    if (!u.employeeNumber)
      return fail(
        "请先联系管理员设置销售工号",
        "EMPLOYEE_NUMBER_REQUIRED",
        409,
      );
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
    const file = form.get("contract");
    if (!(file instanceof File) || !file.size)
      return fail("请上传合同文件", "CONTRACT_REQUIRED");
    if (!contractFileTypes.has(file.type))
      return fail("合同仅支持 PDF、Word、JPG、PNG、WEBP", "INVALID_FILE_TYPE");
    if (file.size > 10 * 1024 * 1024)
      return fail("合同文件不能超过 10MB", "FILE_TOO_LARGE");
    const customer = await db.customer.findUnique({
      where: { id: p.data.customerId },
    });
    if (!customer)
      return fail("客户不存在，请先创建客户", "CUSTOMER_NOT_FOUND", 404);
    const staffIds = [
        p.data.signerId,
        p.data.responsibleUserId,
        p.data.collaboratorId,
        p.data.receivableResponsibleUserId,
        ...(p.data.receivableCollaboratorUserId
          ? [p.data.receivableCollaboratorUserId]
          : []),
      ],
      staffCount = await db.user.count({
        where: { id: { in: [...new Set(staffIds)] }, status: "ACTIVE" },
      });
    if (staffCount !== new Set(staffIds).size)
      return fail("所选负责人或协同人不存在或已停用", "INVALID_STAFF", 400);
    const fileUrl = await saveUpload(file, {
      prefix: "contract",
      subdirectory: "contracts",
      types: contractFileTypes,
      maxBytes: 10 * 1024 * 1024,
    });
    const managerCreated = u.role.code === "SALES_MANAGER",
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
      const date = chinaDateNumber();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`contract-number-${u.employeeNumber}-${date}`}))`;
      const count = await tx.contract.count({
          where: {
            contractNumber: { startsWith: date, endsWith: u.employeeNumber! },
          },
        }),
        contractNumber = documentNumber(u.employeeNumber!, date, count + 1);
      await tx.customer.update({
        where: { id: customer.id },
        data: { ownerId: u.id },
      });
      const contract = await tx.contract.create({
        data: {
          name: `${p.data.name}合同`,
          contractNumber,
          businessType: p.data.businessType,
          signingStatus: p.data.signingStatus,
          customerId: customer.id,
          salesUserId: u.id,
          signerId: p.data.signerId,
          responsibleUserId: p.data.responsibleUserId,
          collaboratorId: p.data.collaboratorId,
          productTotal: p.data.productTotal,
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
          contractId: contract.id,
          customerId: customer.id,
          salesUserId: u.id,
          name: p.data.name,
          contact: customer.contact,
          phone: customer.phone,
          address: customer.address,
          contactInfo: customer.contactInfo,
          amount: p.data.amount,
          projectRequirements: p.data.projectRequirements,
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
          responsibleUserId: p.data.receivableResponsibleUserId,
          collaboratorUserId: p.data.receivableCollaboratorUserId,
        },
      });
      await tx.operationLog.create({
        data: {
          userId: u.id,
          action: "SUBMIT_ORDER",
          module: "ORDER",
          targetId: item.id,
          description: `提交订单“${item.name}”审核，并设为客户“${customer.name}”的负责销售`,
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
    return apiError(e);
  }
}
