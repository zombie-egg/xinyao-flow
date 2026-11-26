import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAttachmentCategory, storedAttachments } from "@/lib/attachment-storage";
import { PageHeader } from "@/components/page";
export default async function Attachments({ params }: { params: Promise<{ category: string; id: string }> }) {
  await requireUser();
  const { category, id } = await params;
  if (!isAttachmentCategory(category) || !/^[a-f0-9-]{36}$/.test(id)) notFound();
  const files = await storedAttachments(`/attachments/${category}/${id}`).catch(() => null);
  if (!files) notFound();
  return <><PageHeader title="附件列表" description={`共 ${files.length} 个附件`}/><ul className="space-y-3">{files.map((file, index) => <li key={`${file.url}-${index}`}><a href={file.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline">{file.name}</a></li>)}</ul></>;
}
