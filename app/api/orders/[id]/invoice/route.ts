import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { readFormAttachments, saveAttachmentBundle } from "@/lib/attachment-storage";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({
  required: z.enum(["YES", "NO"]),
  note: z.string().trim().max(1000).optional(),
});
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await requirePermission("invoice:manage"),
      { id } = await params;
    let form: FormData;
    try {
      form = await req.formData();
    } catch (error) {
      console.error("发票上传表单解析失败", error);
      return fail(
        "发票表单解析失败，请检查网络后重试",
        "INVALID_MULTIPART",
        400,
      );
    }
    const p = schema.safeParse(Object.fromEntries(form.entries()));
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const order = await db.order.findUnique({ where: { id } });
    if (order?.historicalSalesName)
      return fail("离职人员历史订单仅用于查询和统计", "HISTORICAL_ORDER_READ_ONLY", 409);
    if (!order || order.approvalStatus !== "APPROVED")
      return fail("订单尚未通过审核", "ORDER_NOT_APPROVED", 409);
    if (order.invoiceApplicationStatus !== "COMPLETED")
      return fail("销售尚未提交开票申请", "INVOICE_APPLICATION_REQUIRED", 409);
    if (order.invoiceStatus === "COMPLETED")
      return fail("发票事项已经处理", "ALREADY_PROCESSED", 409);
    const required = p.data.required === "YES";
    const files = await readFormAttachments(form, "invoice", u.id, "invoices");
    if (required && !files.length)
      return fail("需要开发票时必须上传发票文件", "INVOICE_FILE_REQUIRED");
    const fileData = await saveAttachmentBundle(files, "invoices");
    const result = await db.$transaction(async (tx) => {
      await tx.invoice.upsert({
        where: { orderId: id },
        update: {
          note: p.data.note,
          ...fileData,
          issuedAt: required ? new Date() : null,
        },
        create: {
          orderId: id,
          note: p.data.note,
          ...fileData,
          issuedAt: required ? new Date() : null,
        },
      });
      const item = await tx.order.update({
        where: { id },
        data: {
          financeUserId: u.id,
          invoiceRequired: required,
          invoiceStatus: "COMPLETED",
          paymentStatus: "PENDING",
          status: "IN_PROGRESS",
        },
      });
      await tx.operationLog.create({
        data: {
          userId: u.id,
          action: "PROCESS_INVOICE",
          module: "ORDER",
          targetId: id,
          description: required ? "已开发票并上传文件" : "确认无需开发票",
        },
      });
      return item;
    });
    return ok(result);
  } catch (e) {
    return apiError(e);
  }
}
