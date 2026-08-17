"use client";

import { useState } from "react";

export function PeriodRangeFields({
  prefix,
  label,
  params,
}: {
  prefix: string;
  label: string;
  params: Record<string, string | undefined>;
}) {
  const [mode, setMode] = useState(params[`${prefix}Mode`] || "date");
  const type = mode === "year" ? "number" : mode;
  const placeholder = mode === "year" ? "例如 2026" : undefined;
  const fieldClass = "h-10 w-full rounded-lg border bg-white px-3 text-sm";
  return (
    <>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}筛选方式</span>
        <select name={`${prefix}Mode`} value={mode} onChange={(event) => setMode(event.target.value)} className={fieldClass}>
          <option value="date">具体日期</option>
          <option value="month">月份</option>
          <option value="year">年份</option>
        </select>
      </label>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}（开始）</span>
        <input name={`${prefix}From`} type={type} min={mode === "year" ? 2000 : undefined} max={mode === "year" ? 2100 : undefined} defaultValue={params[`${prefix}From`]} placeholder={placeholder} className={fieldClass} />
      </label>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}（结束）</span>
        <input name={`${prefix}To`} type={type} min={mode === "year" ? 2000 : undefined} max={mode === "year" ? 2100 : undefined} defaultValue={params[`${prefix}To`]} placeholder={placeholder} className={fieldClass} />
      </label>
    </>
  );
}
