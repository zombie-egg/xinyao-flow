import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Attachment } from "../lib/attachments";

let root: string;
let storage: typeof import("../lib/attachment-storage");
let chunks: typeof import("../lib/chunked-attachments");
const previousRoot = process.env.UPLOAD_DIR;
const bytesStream = (data: Uint8Array) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(data); controller.close(); } });
const hash = (data: Uint8Array) => crypto.createHash("sha256").update(data).digest("hex");
const diskPath = (url: string) => path.join(root, url.slice("/uploads/".length));

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "xinyao-attachments-test-"));
  process.env.UPLOAD_DIR = root;
  storage = await import("../lib/attachment-storage");
  chunks = await import("../lib/chunked-attachments");
});
afterAll(async () => {
  if (previousRoot === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = previousRoot;
  await rm(root, { recursive: true, force: true });
});

describe("业务多附件", () => {
  it("保留任意格式原件，并保存超过原 10MB 限制的文件", async () => {
    const data = crypto.randomBytes(12 * 1024 * 1024 + 37);
    const file = await storage.storeAttachment(bytesStream(data), "合同归档.zip", "application/zip", "contracts");
    expect(file.size).toBe(data.length);
    expect(hash(await readFile(diskPath(file.url)))).toBe(hash(data));
  });
  it("附件数量不设上限，清单往返保留每个原始文件名", async () => {
    const files: Attachment[] = Array.from({ length: 150 }, (_, index) => ({ url: `/uploads/contracts/${crypto.randomUUID()}.dat`, name: `文件 ${index}.dat`, size: index, type: "" }));
    const bundle = await storage.saveAttachmentBundle(files, "contracts");
    expect(await storage.storedAttachments(bundle.fileUrl, bundle.fileName)).toEqual(files);
    const form = new FormData();
    form.set("contractAttachments", JSON.stringify(files.map(file => storage.signAttachment(file, "user-a"))));
    expect(await storage.readFormAttachments(form, "contract", "user-a", "contracts")).toEqual(files);
  });
  it("拒绝跨用户、跨类别及尚未完成的上传引用", async () => {
    const file = { url: `/uploads/contracts/${crypto.randomUUID()}.pdf`, name: "合同.pdf", size: 10, type: "application/pdf" };
    const signed = storage.signAttachment(file, "user-a");
    expect(() => storage.verifyAttachment(signed, "user-b", "contracts")).toThrow("INVALID_ATTACHMENT");
    expect(() => storage.verifyAttachment(signed, "user-a", "payments")).toThrow("INVALID_ATTACHMENT");
    const draft = await storage.beginAttachment("未完成.pdf", "application/pdf", 10, "user-a", "contracts");
    expect(() => storage.verifyAttachment({ token: storage.encodeUploadSession(draft) }, "user-a", "contracts")).toThrow("INVALID_ATTACHMENT");
    const broken = { ...signed, token: signed.token.slice(0, -5) + "aaaaa" };
    expect(() => storage.verifyAttachment(broken, "user-a", "contracts")).toThrow("INVALID_ATTACHMENT");
  });
  it("兼容旧单附件，并避免大文件元数据溢出数据库 Int 字段", async () => {
    expect(await storage.storedAttachments("/uploads/contracts/legacy.pdf", "原合同.pdf")).toEqual([{ url: "/uploads/contracts/legacy.pdf", name: "原合同.pdf", size: 0, type: "" }]);
    const file = { url: `/uploads/contracts/${crypto.randomUUID()}.zip`, name: "大归档.zip", type: "application/zip", size: 3 * 1024 ** 3 };
    expect(await storage.saveAttachmentBundle([file], "contracts")).toMatchObject({ fileUrl: file.url, fileSize: null });
  });
  it("拒绝伪造、跨用户、跨类别和未完成上传的引用", async () => {
    const file = { url: `/uploads/contracts/${crypto.randomUUID()}.pdf`, name: "合同.pdf", size: 10, type: "application/pdf" };
    const signed = storage.signAttachment(file, "user-a");
    expect(() => storage.verifyAttachment({ ...signed, token: signed.token + "bad" }, "user-a", "contracts")).toThrow();
    expect(() => storage.verifyAttachment(signed, "user-b", "contracts")).toThrow();
    expect(() => storage.verifyAttachment(signed, "user-a", "payments")).toThrow();
    const session = await storage.beginAttachment("未完成.pdf", "application/pdf", 10, "user-a", "contracts");
    expect(() => storage.verifyAttachment({ token: storage.encodeUploadSession(session) }, "user-a", "contracts")).toThrow();
  });
  it("multipart 兼容接口也保留多文件和任意类型", async () => {
    const form = new FormData();
    form.append("contract", new File(["archive"], "合同.zip", { type: "application/zip" }));
    form.append("contract", new File(["drawing"], "图纸.dwg", { type: "" }));
    const files = await storage.readFormAttachments(form, "contract", "user-a", "contracts");
    expect(files.map(file => file.name)).toEqual(["合同.zip", "图纸.dwg"]);
  });
});

describe("可恢复分块上传", () => {
  it("12MB 文件跨多个请求保存，重发已接收的分块不会重复追加", async () => {
    const data = crypto.randomBytes(12 * 1024 * 1024 + 101);
    let session = await storage.beginAttachment("大附件.7z", "application/x-7z-compressed", data.length, "user-a", "contracts");
    for (let offset = 0; offset < data.length; offset += chunks.CHUNK_BYTES) {
      const chunk = data.subarray(offset, offset + chunks.CHUNK_BYTES);
      const before = session;
      session = await chunks.appendAttachmentChunk(before, bytesStream(chunk), chunk.length, hash(chunk));
      expect(await chunks.appendAttachmentChunk(before, bytesStream(chunk), chunk.length, hash(chunk))).toEqual(session);
      session = storage.decodeUploadSession(storage.encodeUploadSession(session), "user-a");
    }
    expect(session.offset).toBe(data.length);
    expect(hash(await readFile(diskPath(session.file.url)))).toBe(hash(data));
  });
  it("网络中断或校验失败后回退到上一分块，重试可继续", async () => {
    const session = await storage.beginAttachment("资料.bin", "application/octet-stream", 10, "user-a", "payments");
    const part = Buffer.from("12345");
    await expect(chunks.appendAttachmentChunk(session, bytesStream(part), 5, "0".repeat(64))).rejects.toThrow("INVALID_CHUNK");
    expect((await stat(diskPath(session.file.url))).size).toBe(0);
    const next = await chunks.appendAttachmentChunk(session, bytesStream(part), 5, hash(part));
    const interrupted = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("connection lost")); } });
    await expect(chunks.appendAttachmentChunk(next, interrupted, 5, hash(part))).rejects.toThrow("connection lost");
    expect((await stat(diskPath(session.file.url))).size).toBe(5);
    expect((await chunks.appendAttachmentChunk(next, bytesStream(part), 5, hash(part))).offset).toBe(10);
  });
});
