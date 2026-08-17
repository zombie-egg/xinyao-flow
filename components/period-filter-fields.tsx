export function PeriodFilterFields({
  prefix,
  label,
  params,
}: {
  prefix: string;
  label: string;
  params: Record<string, string | undefined>;
}) {
  const fieldClass = "h-10 w-full rounded-lg border bg-white px-3 text-sm";
  return (
    <>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}从</span>
        <input name={`${prefix}From`} type="date" defaultValue={params[`${prefix}From`] || ""} className={fieldClass} />
      </label>
      <label className="text-xs text-zinc-400">
        <span className="mb-1 block">{label}到</span>
        <input name={`${prefix}To`} type="date" defaultValue={params[`${prefix}To`] || ""} className={fieldClass} />
      </label>
    </>
  );
}
