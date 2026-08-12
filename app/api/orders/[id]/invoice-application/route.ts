import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { saveUpload } from "@/lib/uploads";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({
  note: z.string().trim().min(2, "请填写开票内容或备注").max(2000),
});
const types = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
]);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(),
      { id } = await params,
      form = await req.formData(),
      p = schema.safeParse(Object.fromEntries(form.entries()));
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const order = await db.order.findUnique({ where: { id }, include: { customer: { include: { collaborators: { select: { userId: true } } } } } });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    if (!user.role.code.startsWith("SALES") || (order.salesUserId !== user.id && !order.customer.collaborators.some((item) => item.userId === user.id)))
      throw new Error("FORBIDDEN");
    if (
      order.approvalStatus !== "APPROVED" ||
      order.invoiceApplicationStatus !== "PENDING"
    )
      return fail("当前订单不能申请开票", "INVALID_STATE", 409);
    const file = form.get("invoiceInfo");
    if (!(file instanceof File) || !file.size)
      return fail("请上传开票信息文件", "INVOICE_INFO_REQUIRED");
    if (!types.has(file.type))
      return fail("开票信息支持图片、PDF、Word 或 Excel", "INVALID_FILE_TYPE");
    if (file.size > 8 * 1024 * 1024)
      return fail("开票信息文件不能超过 8MB", "FILE_TOO_LARGE");
    const fileUrl = await saveUpload(file, {
      prefix: "invoice-application",
      subdirectory: "invoice-applications",
      types,
      maxBytes: 8 * 1024 * 1024,
      optimizeImage: true,
    });
    const result = await db.$transaction(async (tx) => {
      const item = await tx.order.update({
        where: { id },
        data: {
          invoiceApplicationStatus: "COMPLETED",
          invoiceApplicationFileUrl: fileUrl,
          invoiceApplicationFileName: file.name,
          invoiceApplicationFileSize: file.size,
          invoiceApplicationFileType: file.type,
          invoiceApplicationNote: p.data.note,
          invoiceAppliedAt: new Date(),
          invoiceStatus: "PENDING",
        },
      });
      const finance = await tx.user.findMany({
        where: { department: { code: "FINANCE" }, status: "ACTIVE" },
        select: { id: true },
      });
      if (finance.length)
        await tx.notification.createMany({
          data: finance.map((x) => ({
            userId: x.id,
            type: "ORDER" as const,
            title: "新的发票待办",
            content: `${item.orderNumber} · ${item.name}`,
            targetId: id,
          })),
        });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "APPLY_INVOICE",
          module: "ORDER",
          targetId: id,
          description: `销售申请开票：${p.data.note}`,
        },
      });
      return item;
    });
    return ok(result);
  } catch (e) {
    return apiError(e);
  }
}
