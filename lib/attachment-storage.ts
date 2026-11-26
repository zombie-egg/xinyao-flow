import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { uploadRoot, safeUploadPath } from "./uploads";
import { attachmentCategories, type Attachment, type AttachmentCategory, type UploadedAttachment } from "./attachments";

const secret = () => process.env.AUTH_SECRET || "development-secret-change-me-32chars";
const bundlePattern = /^\/attachments\/(contracts|invoice-applications|invoices|payments)\/([a-f0-9-]{36})$/;

export function signAttachment(file: Attachment, userId: string): UploadedAttachment {
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const data = JSON.stringify({ file, userId, expires, purpose: "attachment" });
  const payload = Buffer.from(data).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return { ...file, token: `${payload}.${signature}` };
}

export function verifyAttachment(value: unknown, userId: string, category: AttachmentCategory): Attachment {
  if (!value || typeof value !== "object" || !("token" in value) || typeof value.token !== "string") throw new Error("INVALID_ATTACHMENT");
  const [payload, signature, extra] = value.token.split(".");
  if (!payload || !signature || extra) throw new Error("INVALID_ATTACHMENT");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("INVALID_ATTACHMENT");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  const file = decoded.file as Attachment;
  if (decoded.purpose !== "attachment" || decoded.userId !== userId || decoded.expires < Date.now() ||
      !file || typeof file.url !== "string" || !file.url.startsWith(`/uploads/${category}/`) ||
      !safeUploadPath(file.url.slice("/uploads/".length).split("/")) ||
      typeof file.name !== "string" || typeof file.type !== "string" ||
      !Number.isSafeInteger(file.size) || file.size < 0) throw new Error("INVALID_ATTACHMENT");
  return file;
}

// Raw request streams go straight to disk; neither multipart parsing nor an arrayBuffer is needed.
export async function storeAttachment(body: ReadableStream<Uint8Array>, name: string, type: string, category: AttachmentCategory): Promise<Attachment> {
  const extension = path.extname(name).slice(1).toLowerCase();
  const safeExtension = /^[a-z0-9]{1,20}$/.test(extension) ? `.${extension}` : "";
  const filename = `${crypto.randomUUID()}${safeExtension}`;
  const directory = path.join(uploadRoot, category);
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, filename);
  let size = 0;
  try {
    await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), new Transform({
      transform(chunk, _encoding, callback) { size += chunk.length; callback(null, chunk); },
    }), createWriteStream(destination, { flags: "wx", mode: 0o644 }));
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  }
  return { url: `/uploads/${category}/${filename}`, name, size, type: type || "application/octet-stream" };
}

export async function readFormAttachments(form: FormData, name: string, userId: string, category: AttachmentCategory): Promise<Attachment[]> {
  const references = form.get(`${name}Attachments`);
  if (typeof references === "string") {
    let values: unknown;
    try { values = JSON.parse(references); } catch { throw new Error("INVALID_ATTACHMENT"); }
    if (!Array.isArray(values)) throw new Error("INVALID_ATTACHMENT");
    return values.map(value => verifyAttachment(value, userId, category));
  }
  // Retain compatibility for clients that still submit multipart files.
  const files: Attachment[] = [];
  for (const value of form.getAll(name)) {
    if (value instanceof File && value.name && value.size) files.push(await storeAttachment(value.stream(), value.name, value.type, category));
  }
  return files;
}

export async function saveAttachmentBundle(files: Attachment[], category: AttachmentCategory) {
  if (!files.length) return { fileUrl: null, fileName: null, fileSize: null, fileType: null };
  if (files.length === 1) return {
    fileUrl: files[0].url, fileName: files[0].name,
    fileSize: files[0].size <= 2147483647 ? files[0].size : null, fileType: files[0].type,
  };
  const id = crypto.randomUUID();
  const directory = path.join(uploadRoot, category);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.attachments.json`), JSON.stringify(files), { flag: "wx", mode: 0o600 });
  const size = files.reduce((total, file) => total + file.size, 0);
  return { fileUrl: `/attachments/${category}/${id}`, fileName: `${files.length} 个附件`, fileSize: size <= 2147483647 ? size : null, fileType: "application/x-xinyao-attachments" };
}

export async function storedAttachments(url: string | null | undefined, name?: string | null): Promise<Attachment[]> {
  if (!url) return [];
  const match = bundlePattern.exec(url);
  if (!match) return [{ url, name: name || "查看附件", size: 0, type: "" }];
  const contents = await readFile(path.join(uploadRoot, match[1], `${match[2]}.attachments.json`), "utf8");
  return JSON.parse(contents) as Attachment[];
}

export function isAttachmentCategory(value: string): value is AttachmentCategory {
  return attachmentCategories.includes(value as AttachmentCategory);
}

export type UploadSession = { file: Attachment; userId: string; offset: number; expires: number; purpose: "upload" };
export function encodeUploadSession(session: UploadSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function decodeUploadSession(token: string, userId: string): UploadSession {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("INVALID_ATTACHMENT");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("INVALID_ATTACHMENT");
  const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as UploadSession;
  if (session.purpose !== "upload" || session.userId !== userId || session.expires < Date.now() ||
      !/^\/uploads\/(contracts|invoice-applications|invoices|payments)\/[a-f0-9-]{36}(\.[a-z0-9]{1,20})?$/.test(session.file.url)) throw new Error("INVALID_ATTACHMENT");
  return session;
}
export async function beginAttachment(name: string, type: string, size: number, userId: string, category: AttachmentCategory) {
  const file = await storeAttachment(new ReadableStream({ start(controller) { controller.close(); } }), name, type, category);
  file.size = size;
  return { file, userId, offset: 0, expires: Date.now() + 24 * 60 * 60 * 1000, purpose: "upload" as const };
}
