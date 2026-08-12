"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const advancedKeys = ["q", "salesUserId", "approvalStatus", "contractStatus", "invoiceStage", "paymentStage", "amountMin", "amountMax", "createdFrom", "createdTo"];

export function OrderFilters({ params, salesUsers }: { params: Record<string, string | undefined>; salesUsers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(advancedKeys.some((key) => Boolean(params[key])));
  const quick = params.quick || "";
  const status = params.status || "ALL";
  const quickItems = [["today", "今日新增"], ["week", "本周新增"], ["mine", "我负责的"], ["collaborative", "我协同的"]] as const;
  const filterHref = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, current]) => {
      if (current) next.set(key, current);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!next.has("status")) next.set("status", "ALL");
    return `/orders?${next.toString()}`;
  };
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
        {quickItems.map(([value, label]) => <Link key={value} href={filterHref({ quick: quick === value ? null : value })} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${quick === value ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}>{label}</Link>)}
        <Link href={filterHref({ status: status === "PROCESSING" ? "ALL" : "PROCESSING" })} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${status === "PROCESSING" ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}>处理中</Link>
        <Link href={filterHref({ status: status === "COMPLETED" ? "ALL" : "COMPLETED" })} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${status === "COMPLETED" ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}>已完成</Link>
        <button type="button" onClick={() => setOpen(!open)} className={`inline-flex shrink-0 items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-medium ${open ? "text-zinc-950" : "text-zinc-600"}`}>全部筛选<ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} /></button>
      </div>
      {open && <form className="rounded-xl border bg-white p-4">
        <input type="hidden" name="status" value={status} />
        {params.quick && <input type="hidden" name="quick" value={params.quick} />}
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Input name="q" defaultValue={params.q} placeholder="搜索订单号、名称、客户或联系人" />
          <select name="salesUserId" defaultValue={params.salesUserId || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部销售人员</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="approvalStatus" defaultValue={params.approvalStatus || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部审核状态</option><option value="PENDING_SALES_MANAGER">等待销售经理</option><option value="PENDING_FINANCE">等待财务</option><option value="PENDING_ADMIN">等待管理员</option><option value="APPROVED">审核通过</option><option value="REJECTED">审核拒绝</option></select>
          <select name="contractStatus" defaultValue={params.contractStatus || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部合同状态</option><option value="SIGNED">已签订</option><option value="PENDING_SIGNATURE">待签订</option></select>
          <select name="invoiceStage" defaultValue={params.invoiceStage || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部开票阶段</option><option value="TO_APPLY">待申请开票</option><option value="TO_INVOICE">待开发票</option><option value="INVOICED">已开发票</option></select>
          <select name="paymentStage" defaultValue={params.paymentStage || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部回款状态</option><option value="PENDING">未回款</option><option value="PARTIAL">部分回款</option><option value="COMPLETED">已回款</option></select>
          <Input name="amountMin" type="number" step="0.01" defaultValue={params.amountMin} placeholder="最低金额" />
          <Input name="amountMax" type="number" step="0.01" defaultValue={params.amountMax} placeholder="最高金额" />
          <Input name="createdFrom" type="date" defaultValue={params.createdFrom} title="创建时间起" />
          <Input name="createdTo" type="date" defaultValue={params.createdTo} title="创建时间止" />
        </div>
        <div className="mt-3 flex gap-2"><Button type="submit">筛选</Button><Link href="/orders?status=ALL" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm">清除筛选</Link></div>
      </form>}
    </div>
  );
}
