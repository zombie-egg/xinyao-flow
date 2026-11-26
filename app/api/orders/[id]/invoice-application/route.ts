import { hasSalesCapabilities } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { readFormAttachments, saveAttachmentBundle } from "@/lib/attachment-storage";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({
  note: z.string().trim().min(2, "请填写开票内容或备注").max(2000),
});
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
    if (order.historicalSalesName)
      return fail("离职人员历史订单仅用于查询和统计", "HISTORICAL_ORDER_READ_ONLY", 409);
    if (!hasSalesCapabilities(user.role.code) || (order.salesUserId !== user.id && !order.customer.collaborators.some((item) => item.userId === user.id)))
      throw new Error("FORBIDDEN");
    if (
      order.approvalStatus !== "APPROVED" ||
      order.invoiceApplicationStatus !== "PENDING"
    )
      return fail("当前订单不能申请开票", "INVALID_STATE", 409);
    const files = await readFormAttachments(form, "invoiceInfo", user.id, "invoice-applications");
    if (!files.length) return fail("请上传开票信息文件", "INVOICE_INFO_REQUIRED");
    const fileData = await saveAttachmentBundle(files, "invoice-applications");
    const result = await db.$transaction(async (tx) => {
      const item = await tx.order.update({
        where: { id },
        data: {
          invoiceApplicationStatus: "COMPLETED",
          invoiceApplicationFileUrl: fileData.fileUrl,
          invoiceApplicationFileName: fileData.fileName,
          invoiceApplicationFileSize: fileData.fileSize,
          invoiceApplicationFileType: fileData.fileType,
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
