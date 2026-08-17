"use client";

import { useState } from "react";

export function PeriodFilterFields({
  prefix,
  label,
  params,
}: {
  prefix: string;
  label: string;
  params: Record<string, string | undefined>;
}) {
  const [year, setYear] = useState(params[`${prefix}Year`] || "");
  const [month, setMonth] = useState(params[`${prefix}Month`] || "");
  const [date, setDate] = useState(params[`${prefix}Date`] || "");
  const years = Array.from({ length: 41 }, (_, index) => String(2000 + index));
  const fieldClass = "h-10 w-full rounded-lg border bg-white px-3 text-sm";
  return (
    <>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}年份</span>
        <select name={`${prefix}Year`} value={year} onChange={(event) => { setYear(event.target.value); if (event.target.value) { setMonth(""); setDate(""); } }} className={fieldClass}>
          <option value="">全部年份</option>
          {years.map((item) => <option key={item} value={item}>{item}年</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}月份</span>
        <input name={`${prefix}Month`} type="month" value={month} onChange={(event) => { setMonth(event.target.value); if (event.target.value) { setYear(""); setDate(""); } }} className={fieldClass} />
      </label>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}日期</span>
        <input name={`${prefix}Date`} type="date" value={date} onChange={(event) => { setDate(event.target.value); if (event.target.value) { setYear(""); setMonth(""); } }} className={fieldClass} />
      </label>
    </>
  );
}
