"use client";

import { useState } from "react";

function Boundary({ prefix, side, label, params }: { prefix: string; side: "From" | "To"; label: string; params: Record<string, string | undefined> }) {
  const modeName = `${prefix}${side}Mode`;
  const valueName = `${prefix}${side}Value`;
  const [mode, setMode] = useState(params[modeName] || "date");
  const inputType = mode === "year" ? "number" : mode === "month" ? "month" : "date";
  return <label className="text-xs text-zinc-400">
    <span className="mb-1 block">{label}{side === "From" ? "从" : "到"}</span>
    <div className="flex min-w-48 gap-1">
      <select name={modeName} value={mode} onChange={(event) => setMode(event.target.value)} className="h-9 rounded-lg border bg-white px-2 text-xs">
        <option value="year">年</option><option value="month">年月</option><option value="date">日期</option>
      </select>
      <input key={mode} name={valueName} type={inputType} min={mode === "year" ? "2000" : undefined} max={mode === "year" ? "2040" : undefined} defaultValue={params[valueName] || ""} placeholder={mode === "year" ? "例如 2026" : undefined} className="h-9 min-w-0 flex-1 rounded-lg border bg-white px-2 text-xs" />
    </div>
  </label>;
}

export function PeriodFilterFields({ prefix, label, params }: { prefix: string; label: string; params: Record<string, string | undefined> }) {
  return <><Boundary prefix={prefix} side="From" label={label} params={params} /><Boundary prefix={prefix} side="To" label={label} params={params} /></>;
}
