"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { businessLineText, customerStatusText, monitoringTypes } from "@/lib/customer-labels";

type SalesUser = { id: string; name: string };
type Customer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string | null;
  contactInfo: string | null;
  remark: string | null;
  businessLine: "ENVIRONMENTAL_MONITORING" | "PUBLIC_HEALTH";
  monitoringType: string | null;
  industry: string;
  status: string;
  nature: string | null;
  owner: { id: string; name: string };
  collaborators: { user: SalesUser }[];
  contactMethods: { id: string; label: string | null; value: string }[];
};

function CustomerFields({
  customer,
  salesUsers,
  canAssignOwner,
}: {
  customer?: Customer;
  salesUsers: SalesUser[];
  canAssignOwner: boolean;
}) {
  const [businessLine, setBusinessLine] = useState(
    customer?.businessLine || "ENVIRONMENTAL_MONITORING",
  );
  const [contacts, setContacts] = useState(
    customer?.contactMethods
      .filter((item) => item.label !== "电话" || item.value !== customer.phone)
      .map((item) => ({ label: item.label || "其他", value: item.value })) || [],
  );
  const selectedCollaborators = new Set(
    customer?.collaborators.map((item) => item.user.id) || [],
  );
  return (
    <>
      <label className="text-sm">
        <span className="text-red-500">* </span>业务线
        <select
          name="businessLine"
          value={businessLine}
          onChange={(event) => setBusinessLine(event.target.value as typeof businessLine)}
          className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
        >
          <option value="ENVIRONMENTAL_MONITORING">环境监测</option>
          <option value="PUBLIC_HEALTH">公共卫生</option>
        </select>
      </label>
      {businessLine === "ENVIRONMENTAL_MONITORING" && (
        <label className="text-sm">
          <span className="text-red-500">* </span>环境监测类型
          <select
            name="monitoringType"
            required
            defaultValue={customer?.monitoringType || "验收监测"}
            className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
          >
            {monitoringTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      )}
      <label className="text-sm">
        <span className="text-red-500">* </span>客户名称
        <Input name="name" defaultValue={customer?.name} className="mt-2" required />
      </label>
      <label className="text-sm">
        <span className="text-red-500">* </span>客户行业
        <Input name="industry" defaultValue={customer?.industry} className="mt-2" required />
      </label>
      <label className="text-sm">
        <span className="text-red-500">* </span>联系人
        <Input name="contact" defaultValue={customer?.contact} className="mt-2" required />
      </label>
      <label className="text-sm">
        <span className="text-red-500">* </span>联系电话
        <Input name="phone" defaultValue={customer?.phone} className="mt-2" required />
      </label>
      <label className="text-sm">
        客户状态
        <select name="status" defaultValue={customer?.status || "POTENTIAL"} className="mt-2 h-10 w-full rounded-lg border bg-white px-3">
          {Object.entries(customerStatusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="text-sm">
        客户性质
        <Input name="nature" defaultValue={customer?.nature || "普通客户"} className="mt-2" />
      </label>
      <label className="text-sm md:col-span-2">
        地址
        <Input name="address" defaultValue={customer?.address || ""} className="mt-2" />
      </label>
      <label className="text-sm md:col-span-2">
        其他联系信息
        <Input name="contactInfo" defaultValue={customer?.contactInfo || ""} className="mt-2" />
      </label>
      <div className="space-y-2 md:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">更多联系方式</span>
          <Button type="button" variant="outline" className="h-8" onClick={() => setContacts([...contacts, { label: "其他", value: "" }])}>添加联系方式</Button>
        </div>
        {contacts.map((item, index) => (
          <div key={index} className="grid grid-cols-[130px_1fr_auto] gap-2">
            <Input value={item.label} onChange={(e) => setContacts(contacts.map((x, i) => i === index ? { ...x, label: e.target.value } : x))} placeholder="类型" />
            <Input value={item.value} onChange={(e) => setContacts(contacts.map((x, i) => i === index ? { ...x, value: e.target.value } : x))} placeholder="联系方式" />
            <Button type="button" variant="outline" onClick={() => setContacts(contacts.filter((_, i) => i !== index))}>删除</Button>
          </div>
        ))}
        <input type="hidden" name="contactMethodsJson" value={JSON.stringify(contacts.filter((item) => item.value.trim()))} />
      </div>
      {canAssignOwner && (
        <label className="text-sm">
          负责销售
          <select name="salesUserId" defaultValue={customer?.owner.id || ""} required className="mt-2 h-10 w-full rounded-lg border bg-white px-3">
            <option value="" disabled>请选择负责销售</option>
            {salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-sm">
        协同销售
        <select name="collaboratorIds" multiple defaultValue={[...selectedCollaborators]} className="mt-2 min-h-28 w-full rounded-lg border bg-white p-3">
          {salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <span className="mt-1 block text-xs text-zinc-400">电脑可按住 Ctrl/Command 多选</span>
      </label>
      <label className="text-sm md:col-span-2">
        备注
        <Input name="remark" defaultValue={customer?.remark || ""} className="mt-2" />
      </label>
    </>
  );
}

export function CustomerManager({
  items,
  canCreate,
  currentUserId,
  salesUsers,
  canAssignOwner,
  canManageAll,
  returnTo,
}: {
  items: Customer[];
  canCreate: boolean;
  currentUserId: string;
  salesUsers: SalesUser[];
  canAssignOwner: boolean;
  canManageAll: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [show, setShow] = useState(Boolean(returnTo));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [duplicateQuery, setDuplicateQuery] = useState("");
  const [duplicates, setDuplicates] = useState<Customer[]>([]);
  const editing = items.find((item) => item.id === editingId);

  function payload(form: HTMLFormElement) {
    const data = new FormData(form);
    const collaboratorIds = data.getAll("collaboratorIds").map(String);
    const contactMethods = JSON.parse(String(data.get("contactMethodsJson") || "[]"));
    return { ...Object.fromEntries(data.entries()), collaboratorIds, contactMethods };
  }
  async function save(event: React.FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    setMessage("");
    const res = await fetch(id ? `/api/customers/${id}` : "/api/customers", {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(event.currentTarget)),
    });
    const body = await res.json();
    if (!res.ok) {
      if (body.code === "CUSTOMER_DUPLICATES") {
        try { setDuplicates(JSON.parse(body.message)); } catch {}
        setMessage("发现重复客户，请先核对下面的查重结果");
      } else setMessage(body.message);
      return;
    }
    if (returnTo) router.push(`${returnTo}${returnTo.includes("?") ? "&" : "?"}customerId=${body.data.id}`);
    else {
      setShow(false);
      setEditingId(null);
      setMessage(id ? "客户信息已更新" : "客户创建成功");
      router.refresh();
    }
  }
  async function checkDuplicates() {
    const res = await fetch(`/api/customers/duplicates?q=${encodeURIComponent(duplicateQuery)}`);
    const body = await res.json();
    if (!res.ok) { setMessage(body.message); return; }
    setDuplicates(body.data);
    setMessage(body.data.length ? `发现 ${body.data.length} 条可能重复客户` : "未发现重复客户");
  }
  return (
    <>
      {canCreate && <div className="mb-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => document.getElementById("duplicate-search")?.scrollIntoView({ behavior: "smooth" })}>客户查重</Button><Button onClick={() => setShow(!show)}>{show ? "取消" : "新建客户"}</Button></div>}
      <Card id="duplicate-search" className="mb-5">
        <h2 className="font-medium">全库客户查重</h2>
        <div className="mt-3 flex gap-2"><Input value={duplicateQuery} onChange={(e) => setDuplicateQuery(e.target.value)} placeholder="输入客户名称、联系人、电话、微信、邮箱或其他联系信息" /><Button type="button" onClick={checkDuplicates}>查重</Button></div>
        {duplicates.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{duplicates.slice(0, 10).map((item) => <Link key={item.id} href={`/customers/${item.id}`} className="rounded-lg border p-3 text-sm hover:bg-zinc-50"><p className="font-medium">{item.name}</p><p className="mt-1 text-zinc-500">{item.contact} · {item.phone} · 负责销售：{item.owner.name}</p></Link>)}</div>}
      </Card>
      {show && <Card className="mb-5"><h2 className="mb-4 font-medium">新建客户</h2><form onSubmit={(e) => save(e)} className="grid gap-4 md:grid-cols-2"><CustomerFields salesUsers={salesUsers} canAssignOwner={canAssignOwner} /><div className="md:col-span-2"><Button>保存客户</Button></div></form></Card>}
      {editing && <Card className="mb-5"><h2 className="mb-4 font-medium">编辑客户</h2><form onSubmit={(e) => save(e, editing.id)} className="grid gap-4 md:grid-cols-2"><CustomerFields customer={editing} salesUsers={salesUsers} canAssignOwner={canAssignOwner} /><div className="md:col-span-2 flex gap-2"><Button>保存修改</Button><Button type="button" variant="outline" onClick={() => setEditingId(null)}>取消</Button></div></form></Card>}
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[1450px] whitespace-nowrap text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr>{["客户名称","业务线","行业","联系人","联系电话","负责销售","协同销售","客户状态","客户性质","操作"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{items.map((item) => { const canEdit = canManageAll || item.owner.id === currentUserId; return <tr key={item.id} className="border-t"><td className="px-4 py-4 font-medium">{item.name}</td><td className="px-4">{businessLineText[item.businessLine]}{item.monitoringType ? ` · ${item.monitoringType}` : ""}</td><td className="px-4">{item.industry}</td><td className="px-4">{item.contact}</td><td className="px-4">{item.phone}</td><td className="px-4">{item.owner.name}</td><td className="px-4">{item.collaborators.map((x) => x.user.name).join("、") || "—"}</td><td className="px-4"><Badge>{customerStatusText[item.status]}</Badge></td><td className="px-4">{item.nature || "—"}</td><td className="px-4"><div className="flex gap-2"><Link href={`/customers/${item.id}`} className="inline-flex h-8 items-center rounded-lg border px-3">查看明细</Link><Link href={`/orders/new?customerId=${item.id}`} className="inline-flex h-8 items-center rounded-lg bg-zinc-950 px-3 text-white">新建订单</Link>{canEdit && <Button type="button" variant="outline" className="h-8" onClick={() => setEditingId(item.id)}>编辑</Button>}</div></td></tr>})}</tbody></table></div>
      {message && <p className="mt-3 text-sm text-zinc-500">{message}</p>}
    </>
  );
}
