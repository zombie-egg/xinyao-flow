import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";
import { saveUpload } from "@/lib/uploads";
import { chinaDateNumber, documentNumber } from "@/lib/document-number";
export const runtime = "nodejs";
const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().nonnegative().optional(),
);
const schema = z
  .object({
    customerId: z.string().min(1),
    name: z.string().trim().min(2).max(150),
    businessType: z.enum(["ENVIRONMENTAL_MONITORING", "PUBLIC_HEALTH"]),
    productTotal: z.coerce.number().positive(),
    amount: z.coerce.number().positive(),
    technicalSupportFee: z.coerce.number().nonnegative(),
    outsourcingFee: z.coerce.number().nonnegative(),
    reviewFee: optionalNumber,
    otherExpense: optionalNumber,
    expenseDetails: z.string().trim().max(3000).optional(),
    originalExpenseNote: z.string().trim().max(3000).optional(),
    adjustedNetAmount: optionalNumber,
    signingStatus: z.enum(["SIGNED", "PENDING_SIGNATURE"]),
    contractDate: z.coerce.date(),
    signerId: z.string().min(1),
    responsibleUserId: z.string().min(1),
    collaboratorId: z.string().min(1),
    projectRequirements: z.string().trim().min(5).max(10000),
    remark: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const expenses =
      value.technicalSupportFee +
      value.outsourcingFee +
      (value.reviewFee || 0) +
      (value.otherExpense || 0);
    if (expenses > value.amount)
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "各项费用合计不能超过合同金额",
      });
  });
const fileTypes = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
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
    const form = await req.formData(),
      p = schema.safeParse(Object.fromEntries(form.entries()));
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const file = form.get("contract");
    if (!(file instanceof File) || !file.size)
      return fail("请上传合同文件", "CONTRACT_REQUIRED");
    if (!fileTypes.has(file.type))
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
      ],
      staffCount = await db.user.count({
        where: { id: { in: [...new Set(staffIds)] }, status: "ACTIVE" },
      });
    if (staffCount !== new Set(staffIds).size)
      return fail("签订人、负责人或协同人不存在或已停用", "INVALID_STAFF", 400);
    const fileUrl = await saveUpload(file, {
      prefix: "contract",
      subdirectory: "contracts",
      types: fileTypes,
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
    });
    return ok(order, 201);
  } catch (e) {
    return apiError(e);
  }
}
