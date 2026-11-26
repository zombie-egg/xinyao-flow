import { requireUser, requirePermission } from "@/lib/auth";
import { hasSalesCapabilities } from "@/lib/customer-access";
import { ok, fail, apiError } from "@/lib/api";
import { beginAttachment, decodeUploadSession, encodeUploadSession, isAttachmentCategory, signAttachment } from "@/lib/attachment-storage";
import { appendAttachmentChunk } from "@/lib/chunked-attachments";
export const runtime = "nodejs";
async function uploadUser(category: string) {
  const user = await requireUser();
  if (!isAttachmentCategory(category)) throw new Error("INVALID_ATTACHMENT");
  if (category === "contracts" || category === "invoice-applications") {
    if (!hasSalesCapabilities(user.role.code)) throw new Error("FORBIDDEN");
  } else await requirePermission(category === "invoices" ? "invoice:manage" : "payment:manage");
  return user;
}
export async function POST(request: Request) {
  try {
    const category = new URL(request.url).searchParams.get("category") || "";
    const user = await uploadUser(category);
    if (!isAttachmentCategory(category)) throw new Error("INVALID_ATTACHMENT");
    const name = decodeURIComponent(request.headers.get("x-upload-name") || "").replace(/[\\/]/g, "_");
    const size = Number(request.headers.get("x-upload-size"));
    if (!name || !Number.isSafeInteger(size) || size < 0) return fail("附件信息无效", "INVALID_ATTACHMENT");
    const session = await beginAttachment(name, request.headers.get("x-upload-type") || "", size, user.id, category);
    return ok(size ? { session: encodeUploadSession(session), offset: 0 } : { uploaded: signAttachment(session.file, user.id) }, 201);
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request) {
  try {
    const category = new URL(request.url).searchParams.get("category") || "";
    const user = await uploadUser(category);
    const session = decodeUploadSession(request.headers.get("x-upload-session") || "", user.id);
    if (!session.file.url.startsWith(`/uploads/${category}/`) || !request.body) return fail("上传信息无效", "INVALID_ATTACHMENT");
    const next = await appendAttachmentChunk(session, request.body, Number(request.headers.get("x-chunk-size")), request.headers.get("x-chunk-sha256") || "");
    return ok(next.offset === next.file.size ? { uploaded: signAttachment(next.file, user.id) } : { session: encodeUploadSession(next), offset: next.offset });
  } catch (error) {
    if (error instanceof Error && error.message === "UPLOAD_BUSY") return fail("附件正在保存，请稍后重试", "UPLOAD_BUSY", 409);
    if (error instanceof Error && ["INVALID_CHUNK", "INVALID_ATTACHMENT", "UPLOAD_OFFSET_MISMATCH"].includes(error.message)) return fail("附件上传校验失败，请重试", error.message, 400);
    return apiError(error);
  }
}
