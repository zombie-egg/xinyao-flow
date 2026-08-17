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
  const years = Array.from({ length: 41 }, (_, index) => String(2000 + index));
  const fieldClass = "h-10 w-full rounded-lg border bg-white px-3 text-sm";
  const valueFor = (side: "From" | "To") => (params[`${prefix}Mode`] || "date") === mode ? params[`${prefix}${side}`] : undefined;
  const picker = (side: "From" | "To") => mode === "year" ? (
    <select key={`${mode}-${side}`} name={`${prefix}${side}`} defaultValue={valueFor(side) || ""} className={fieldClass}>
      <option value="">请选择年份</option>
      {years.map((year) => <option key={year} value={year}>{year}年</option>)}
    </select>
  ) : (
    <input key={`${mode}-${side}`} name={`${prefix}${side}`} type={mode} defaultValue={valueFor(side)} className={fieldClass} />
  );
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
        {picker("From")}
      </label>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}（结束）</span>
        {picker("To")}
      </label>
    </>
  );
}
