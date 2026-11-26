import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat, truncate, unlink } from "node:fs/promises";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { safeUploadPath } from "./uploads";
import type { UploadSession } from "./attachment-storage";

// A bounded transport chunk is independent of the total file size.
export const CHUNK_BYTES = 4 * 1024 * 1024;
export async function appendAttachmentChunk(session: UploadSession, body: ReadableStream<Uint8Array>, bytes: number, checksum: string) {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > CHUNK_BYTES || !/^[a-f0-9]{64}$/.test(checksum) || session.offset + bytes > session.file.size) throw new Error("INVALID_CHUNK");
  const destination = safeUploadPath(session.file.url.slice("/uploads/".length).split("/"));
  if (!destination) throw new Error("INVALID_ATTACHMENT");
  const lockPath = `${destination}.lock`;
  const lock = await open(lockPath, "wx").catch(() => { throw new Error("UPLOAD_BUSY"); });
  let append = false;
  try {
    const { size } = await stat(destination);
    // A lost acknowledgement can safely retry the same chunk.
    if (size !== session.offset && size !== session.offset + bytes) throw new Error("UPLOAD_OFFSET_MISMATCH");
    append = size === session.offset;
    let received = 0;
    const hash = crypto.createHash("sha256");
    const meter = new Transform({ transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > bytes) { callback(new Error("INVALID_CHUNK")); return; }
      hash.update(chunk); callback(null, chunk);
    } });
    await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), meter,
      append ? createWriteStream(destination, { flags: "a" }) : new Writable({ write(_chunk, _encoding, callback) { callback(); } }));
    if (received !== bytes || hash.digest("hex") !== checksum) throw new Error("INVALID_CHUNK");
    if (!append) {
      const savedHash = crypto.createHash("sha256");
      for await (const chunk of createReadStream(destination, { start: session.offset, end: session.offset + bytes - 1 })) savedHash.update(chunk);
      if (savedHash.digest("hex") !== checksum) throw new Error("UPLOAD_OFFSET_MISMATCH");
    }
    return { ...session, offset: session.offset + bytes };
  } catch (error) {
    if (append) await truncate(destination, session.offset);
    throw error;
  } finally { await lock.close(); await unlink(lockPath); }
}
