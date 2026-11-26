import { storedAttachments } from "@/lib/attachment-storage";
export async function AttachmentLinks({ url, name, empty }: { url?: string | null; name?: string | null; empty?: string }) {
  const files = await storedAttachments(url, name);
  if (!files.length) return empty ? <p className="mt-4 text-sm text-zinc-500">{empty}</p> : null;
  return <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.url}-${index}`}><a href={file.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline">{file.name}</a></li>)}</ul>;
}
