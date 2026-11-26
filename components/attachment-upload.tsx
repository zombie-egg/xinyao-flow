"use client";
import { useEffect, useRef, useState } from "react";
import type { AttachmentCategory, UploadedAttachment } from "@/lib/attachments";

type Item = { id: string; name: string; file?: File; uploaded?: UploadedAttachment; progress: number; error?: string };
export function AttachmentUpload({ name, category, required = false, initial = [] }: {
  name: string; category: AttachmentCategory; required?: boolean; initial?: UploadedAttachment[];
}) {
  const [items, setItems] = useState<Item[]>(() => initial.map(file => ({ id: crypto.randomUUID(), name: file.name, uploaded: file, progress: 100 })));
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const requests = useRef(new Set<XMLHttpRequest>());
  const sessions = useRef(new Map<string, { session: string; offset: number }>());
  const ready = items.flatMap(item => item.uploaded ? [item.uploaded] : []);
  const busy = items.some(item => !item.uploaded && !item.error);
  const hasError = items.some(item => item.error);
  useEffect(() => {
    input.current?.setCustomValidity(busy ? "附件正在上传，请完成后提交" : hasError ? "有附件上传失败，请重试或移除" : "");
  }, [busy, hasError]);
  // Upload sequentially so selecting many files does not multiply server memory or disk pressure.
  useEffect(() => {
    if (active.current) return;
    const next = items.find(item => item.file && !item.uploaded && !item.error);
    if (!next?.file) return;
    active.current = true;
    const selected: File = next.file;
    async function upload() {
      try {
        let state = sessions.current.get(next!.id);
        if (!state) {
          const response = await fetch(`/api/attachments?category=${category}`, { method: "POST", headers: {
            "x-upload-name": encodeURIComponent(next!.name), "x-upload-size": String(selected.size), "x-upload-type": selected.type || "application/octet-stream",
          } });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "无法开始上传");
          if (result.data.uploaded) return result.data.uploaded as UploadedAttachment;
          state = result.data as { session: string; offset: number };
          sessions.current.set(next!.id, state);
        }
        while (state.offset < selected.size) {
          const chunk = selected.slice(state.offset, state.offset + 4 * 1024 * 1024);
          const digest = await crypto.subtle.digest("SHA-256", await chunk.arrayBuffer());
          const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
          const current = state;
          const result = await new Promise<{ uploaded?: UploadedAttachment; session: string; offset: number }>((resolve, reject) => {
            const request = new XMLHttpRequest();
            requests.current.add(request);
            request.open("PUT", `/api/attachments?category=${category}`);
            request.setRequestHeader("content-type", "application/octet-stream");
            request.setRequestHeader("x-upload-session", current.session);
            request.setRequestHeader("x-chunk-size", String(chunk.size));
            request.setRequestHeader("x-chunk-sha256", checksum);
            request.upload.onprogress = event => {
              setItems(previous => previous.map(item => item.id === next!.id ? { ...item, progress: Math.round((current.offset + event.loaded) / selected.size * 100) } : item));
            };
            const failed = () => { requests.current.delete(request); reject(new Error("网络中断，请重试")); };
            request.onerror = failed; request.onabort = failed;
            request.onload = () => {
              requests.current.delete(request);
              try {
                const body = JSON.parse(request.responseText);
                if (request.status >= 200 && request.status < 300 && body.data) resolve(body.data);
                else reject(new Error(body.message || `上传失败（HTTP ${request.status}）`));
              } catch { reject(new Error(`上传失败（HTTP ${request.status}），请重试`)); }
            };
            request.send(chunk);
          });
          if (result.uploaded) return result.uploaded;
          state = { session: result.session, offset: result.offset };
          sessions.current.set(next!.id, state);
        }
        throw new Error("上传未完成，请重试");
      } finally { active.current = false; }
    }
    void upload().then(uploaded => {
      sessions.current.delete(next.id);
      setItems(previous => previous.map(item => item.id === next.id ? { ...item, uploaded, file: undefined, progress: 100 } : item));
    }).catch(error => setItems(previous => previous.map(item => item.id === next.id ? { ...item, error: error instanceof Error ? error.message : "上传失败，请重试" } : item)));

  }, [items, category]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setItems([]);
    form?.addEventListener("reset", reset);
    const pending = requests.current;
    return () => { form?.removeEventListener("reset", reset); for (const request of pending) request.abort(); };
  }, []);
  return <div className="mt-2 space-y-2">
    <input ref={input} type="file" multiple required={required && ready.length === 0} className="block max-w-full text-sm" onChange={event => {
      const selected = Array.from(event.target.files || []).map(file => ({ id: crypto.randomUUID(), name: file.name, file, progress: 0 }));
      if (selected.length) input.current?.setCustomValidity("附件正在上传，请完成后提交");
      setItems(previous => [...previous, ...selected]);
      event.target.value = "";
    }}/>
    <input type="hidden" name={`${name}Attachments`} value={JSON.stringify(ready)}/>
    <p className="text-xs text-zinc-400">可多选或继续添加，附件数量、大小和格式不限。请等待上传完成后提交。</p>
    {!!items.length && <ul className="space-y-2 text-sm">{items.map(item => <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2">
      <span className="min-w-0 flex-1 break-all">{item.name}</span>
      <span className={item.error ? "text-red-600" : "text-zinc-500"}>{item.error || (item.uploaded ? "已上传" : `上传中 ${item.progress}%`)}</span>
      {item.error && <button type="button" className="underline" onClick={() => setItems(previous => previous.map(value => value.id === item.id ? { ...value, error: undefined, progress: 0 } : value))}>重试</button>}
      {(item.uploaded || item.error) && <button type="button" className="text-zinc-500 underline" onClick={() => setItems(previous => previous.filter(value => value.id !== item.id))}>移除</button>}
    </li>)}</ul>}
  </div>;
}
