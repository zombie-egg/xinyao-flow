"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type Entity = "customers" | "orders";
type Result = {
  filename: string; sheetName: string; totalRows: number; headers: string[];
  mapping: Record<string, string | null>; targetFields: readonly (readonly [string, string])[];
  ai: { used: boolean; agreed: boolean; notes: string[]; error?: string };
  unmatchedPeople: string[]; preview: { row: number; owner: { name: string } | null; collaborators: { name: string }[]; issues: string[]; ready: boolean; source: Record<string, unknown> }[];
  message: string;
};

export function DataImportExport({ entity, canImport }: { entity: Entity; canImport: boolean }) {
  const [open, setOpen] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [publicPool, setPublicPool] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  async function preview() {
    if (!file) return setMessage("请选择要导入的文件");
    setLoading(true); setMessage(""); setResult(null);
    const form = new FormData(); form.set("entity", entity); form.set("useAi", String(useAi)); form.set("publicPool", String(entity === "customers" && publicPool)); form.set("file", file);
    const response = await fetch("/api/import/preview", { method: "POST", body: form });
    const body = await response.json(); setLoading(false);
    if (!response.ok) return setMessage(body.message || "无法解析导入文件");
    setResult(body.data); setMessage(body.data.message);
  }
  return <div className="mb-4">
    <div className="flex flex-wrap justify-end gap-2">
      <a href={`/api/${entity}/export`} className="inline-flex h-9 items-center rounded-lg border bg-white px-3 text-xs font-medium">导出 CSV</a>
      {canImport && <Button type="button" className="h-9 text-xs" onClick={() => setOpen(!open)}>导入数据</Button>}
    </div>
    {open && <Card className="mt-3 space-y-4">
      <div><h2 className="font-medium">{entity === "customers" ? "导入客户" : "导入订单"}</h2><p className="mt-1 text-sm text-zinc-500">支持 XLSX、XLS、CSV、JSON，最大 20MB。先预览审核，不会直接写入数据库。</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] || null)} className="max-w-full text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useAi} onChange={(event) => setUseAi(event.target.checked)} />使用 DeepSeek AI 辅助字段对应</label>
        {entity === "customers" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publicPool} onChange={(event) => setPublicPool(event.target.checked)} />整份文件作为公海客户</label>}
        <Button type="button" onClick={preview} disabled={loading}>{loading ? "正在分析…" : "生成导入预览"}</Button>
      </div>
      {message && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
      {result && <div className="space-y-4 text-sm">
        <div className="grid gap-2 rounded-lg bg-zinc-50 p-3 md:grid-cols-4"><span>文件：{result.filename}</span><span>工作表：{result.sheetName}</span><span>总记录：{result.totalRows}</span><span>AI：{result.ai.used ? (result.ai.agreed ? "已审核一致" : "需人工复核") : "未启用"}</span></div>
        <div><p className="mb-2 font-medium">字段对应</p><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{result.targetFields.map(([field, label]) => <div key={field} className={`rounded-lg border p-2 ${result.mapping[field] ? "" : "border-amber-300 bg-amber-50"}`}><span className="text-zinc-500">{label}</span><p>{result.mapping[field] || "未对应"}</p></div>)}</div></div>
        {!!result.unmatchedPeople.length && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700"><p className="font-medium">尚未注册或无法匹配的人员</p><p className="mt-1">{result.unmatchedPeople.join("、")}</p><p className="mt-1 text-xs">包含这些人员的记录暂不导入。</p></div>}
        {!!result.ai.notes.length && <div className="rounded-lg border p-3"><p className="font-medium">AI / 系统审核备注</p>{result.ai.notes.map((note, index) => <p key={index} className="mt-1 text-zinc-500">{note}</p>)}</div>}
        <div className="overflow-x-auto rounded-lg border"><table className="min-w-[900px] w-full text-left"><thead className="bg-zinc-50 text-zinc-500"><tr><th className="p-2">源行</th><th className="p-2">负责人</th><th className="p-2">协同人</th><th className="p-2">状态</th><th className="p-2">问题</th></tr></thead><tbody>{result.preview.map((row) => <tr key={row.row} className="border-t"><td className="p-2">{row.row}</td><td className="p-2">{row.owner?.name || "—"}</td><td className="p-2">{row.collaborators.map((x) => x.name).join("、") || "—"}</td><td className="p-2">{row.ready ? "可导入" : "暂缓"}</td><td className="p-2 text-red-600">{row.issues.join("；") || "—"}</td></tr>)}</tbody></table></div>
        {result.totalRows > 100 && <p className="text-xs text-zinc-400">页面仅展示前 100 条预览，统计覆盖全部记录。</p>}
      </div>}
    </Card>}
  </div>;
}
