"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { customerStatusText } from "@/lib/customer-labels";

const advancedKeys = ["q", "ownerId", "customerStatus", "nature", "industry", "businessLine", "createdFrom", "createdTo", "updatedFrom", "updatedTo"];

export function CustomerFilters({ params, salesUsers, canCreate }: { params: Record<string, string | undefined>; salesUsers: { id: string; name: string }[]; canCreate: boolean }) {
  const [open, setOpen] = useState(advancedKeys.some((key) => Boolean(params[key])));
  const quick = params.quick || "";
  const quickItems = [["today", "今日新增"], ["week", "本周新增"], ["mine", "我负责的"], ["collaborative", "我协同的"]] as const;
  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto pb-1">
          {quickItems.map(([value, label]) => <Link key={value} href={quick === value ? "/customers" : `/customers?quick=${value}`} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${quick === value ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}>{label}</Link>)}
          <button type="button" onClick={() => setOpen(!open)} className={`inline-flex shrink-0 items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-medium ${open ? "text-zinc-950" : "text-zinc-600"}`}>全部筛选<ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} /></button>
        </div>
        {canCreate && <div className="flex shrink-0 gap-1.5"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("customer:toggle-duplicates"))} className="rounded-lg border bg-white px-3 py-2 text-xs font-medium">客户查重</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("customer:toggle-create"))} className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-medium text-white">新建客户</button></div>}
      </div>
      {open && <form className="rounded-xl border bg-white p-4">
        {params.return && <input type="hidden" name="return" value={params.return} />}
        {params.quick && <input type="hidden" name="quick" value={params.quick} />}
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Input name="q" defaultValue={params.q} placeholder="搜索客户、联系人、联系方式或行业" />
          <select name="ownerId" defaultValue={params.ownerId || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部跟进人</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="customerStatus" defaultValue={params.customerStatus || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部客户状态</option>{Object.entries(customerStatusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <Input name="nature" defaultValue={params.nature} placeholder="客户性质" />
          <Input name="industry" defaultValue={params.industry} placeholder="客户行业" />
          <select name="businessLine" defaultValue={params.businessLine || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部业务线</option><option value="ENVIRONMENTAL_MONITORING">环境监测</option><option value="PUBLIC_HEALTH">公共卫生</option></select>
          <Input name="createdFrom" type="date" defaultValue={params.createdFrom} title="创建时间起" />
          <Input name="createdTo" type="date" defaultValue={params.createdTo} title="创建时间止" />
          <Input name="updatedFrom" type="date" defaultValue={params.updatedFrom} title="更新时间起" />
          <Input name="updatedTo" type="date" defaultValue={params.updatedTo} title="更新时间止" />
        </div>
        <div className="mt-3 flex gap-2"><Button type="submit">筛选</Button><Link href="/customers" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm">清除筛选</Link></div>
      </form>}
    </div>
  );
}
