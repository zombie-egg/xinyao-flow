import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { safeUploadPath } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function fileHeaders(filePath: string, size: number, modifiedAt: number) {
  return new Headers({
    "content-type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "content-length": String(size),
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
    etag: `W/\"${size}-${Math.floor(modifiedAt)}\"`,
    "last-modified": new Date(modifiedAt).toUTCString(),
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`,
    "x-content-type-options": "nosniff",
  });
}

async function resolveFile(params: Promise<{ path: string[] }>) {
  const filePath = safeUploadPath((await params).path);
  if (!filePath) return null;
  const info = await stat(filePath);
  return info.isFile() ? { filePath, info } : null;
}

export async function HEAD(
  _: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const file = await resolveFile(params);
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(null, {
      headers: fileHeaders(file.filePath, file.info.size, file.info.mtimeMs),
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const file = await resolveFile(params);
    if (!file) return new Response("Not found", { status: 404 });
    const { filePath, info } = file;
    const headers = fileHeaders(filePath, info.size, info.mtimeMs);
    if (request.headers.get("if-none-match") === headers.get("etag"))
      return new Response(null, { status: 304, headers });

    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match)
        return new Response(null, {
          status: 416,
          headers: { "content-range": `bytes */${info.size}` },
        });
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : info.size - 1;
      if (!match[1] && match[2]) {
        const suffixLength = Number(match[2]);
        start = Math.max(0, info.size - suffixLength);
        end = info.size - 1;
      }
      if (start < 0 || end < start || start >= info.size) {
        return new Response(null, {
          status: 416,
          headers: { "content-range": `bytes */${info.size}` },
        });
      }
      end = Math.min(end, info.size - 1);
      headers.set("content-range", `bytes ${start}-${end}/${info.size}`);
      headers.set("content-length", String(end - start + 1));
      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers,
      });
    }

    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
