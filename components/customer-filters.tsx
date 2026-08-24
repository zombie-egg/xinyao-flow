"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { customerNatures, customerStatusText } from "@/lib/customer-labels";
import { PeriodFilterFields } from "./period-filter-fields";

const advancedKeys = ["q", "category", "ownership", "ownerId", "customerStatus", "nature", "industry", "businessLine", "createdFromValue", "createdToValue", "updatedFromValue", "updatedToValue"];

export function CustomerFilters({ params, salesUsers, canCreate, showPublicPool }: { params: Record<string, string | undefined>; salesUsers: { id: string; name: string }[]; canCreate: boolean; showPublicPool: boolean }) {
  const [open, setOpen] = useState(advancedKeys.some((key) => Boolean(params[key])));
  const quick = params.quick || "";
  const quickItems = [["today", "今日新增"], ["week", "本周新增"], ["mine", "我负责的"], ["collaborative", "我协同的"], ...(showPublicPool ? [["public", "公海池"]] as const : [])] as const;
  const toggleQuickHref = (value: string) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, current]) => {
      if (current && key !== "quick") next.set(key, current);
    });
    if (quick !== value) next.set("quick", value);
    const query = next.toString();
    return query ? `/customers?${query}` : "/customers";
  };
  const panelHref = (panel: "duplicates" | "create") => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== "panel") next.set(key, value);
    });
    next.set("panel", panel);
    return `/customers?${next.toString()}`;
  };
  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto pb-1">
          {quickItems.map(([value, label]) => <Link key={value} href={toggleQuickHref(value)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${quick === value ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}>{label}</Link>)}
          <button type="button" onClick={() => setOpen(!open)} className={`inline-flex shrink-0 items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-medium ${open ? "text-zinc-950" : "text-zinc-600"}`}>全部筛选<ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} /></button>
        </div>
        {canCreate && <div className="ml-auto flex shrink-0 gap-1.5"><Link href={panelHref("duplicates")} className="inline-flex h-9 min-w-20 items-center justify-center whitespace-nowrap rounded-lg border bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50">客户查重</Link><Link href={panelHref("create")} className="inline-flex h-9 min-w-20 items-center justify-center whitespace-nowrap rounded-lg border bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50">新建客户</Link><Link href="/api/customers/export" className="inline-flex h-9 min-w-20 items-center justify-center whitespace-nowrap rounded-lg border bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50">导出 CSV</Link><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("data-import:toggle-customers"))} className="inline-flex h-9 min-w-20 items-center justify-center whitespace-nowrap rounded-lg border bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50">导入数据</button></div>}
      </div>
      {open && <form className="rounded-xl border bg-white p-4">
        {params.return && <input type="hidden" name="return" value={params.return} />}
        {params.quick && <input type="hidden" name="quick" value={params.quick} />}
        <div className="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Input name="q" defaultValue={params.q} placeholder="搜索客户、联系人、联系方式或行业" />
          <select name="category" defaultValue={params.category || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部客户模板</option><option value="XINYAO_ENVIRONMENT">心邀环境</option><option value="OCCUPATIONAL_HEALTH">职业卫生</option></select>
          <select name="ownership" defaultValue={params.ownership || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部客户归属</option><option value="PUBLIC">公海客户</option><option value="TRACKED">跟进客户</option></select>
          <select name="ownerId" defaultValue={params.ownerId || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部跟进人</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="customerStatus" defaultValue={params.customerStatus || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部客户状态</option>{Object.entries(customerStatusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="nature" defaultValue={params.nature || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部客户性质</option>{customerNatures.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <Input name="industry" defaultValue={params.industry} placeholder="客户行业" />
          <select name="businessLine" defaultValue={params.businessLine || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部业务线</option><option value="ENVIRONMENTAL_MONITORING">环境检测</option><option value="PUBLIC_HEALTH">公共卫生</option><option value="OCCUPATIONAL_HEALTH">职业卫生</option></select>
          <PeriodFilterFields prefix="created" label="创建" params={params} />
          <PeriodFilterFields prefix="updated" label="更新" params={params} />
        </div>
        <div className="mt-3 flex gap-2"><Button type="submit">筛选</Button><Link href="/customers" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm">清除筛选</Link></div>
      </form>}
    </div>
  );
}
