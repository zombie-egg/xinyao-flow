"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function PublicCustomerClaim({
  customerId,
  salesUsers,
}: {
  customerId: string;
  salesUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function claim() {
    if (!ownerId) {
      setMessage("请选择负责销售");
      return;
    }
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/customers/${customerId}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, collaboratorIds }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open)
    return <Button type="button" className="h-8" onClick={() => setOpen(true)}>认领客户</Button>;

  return (
    <div className="min-w-64 space-y-2 rounded-lg border bg-zinc-50 p-3">
      <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="h-9 w-full rounded-lg border bg-white px-2 text-sm">
        <option value="">选择负责销售</option>
        {salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select multiple value={collaboratorIds} onChange={(event) => setCollaboratorIds([...event.target.selectedOptions].map((option) => option.value))} className="min-h-24 w-full rounded-lg border bg-white p-2 text-sm">
        {salesUsers.filter((item) => item.id !== ownerId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p className="text-xs text-zinc-400">协同跟进人非必填，可按 Ctrl/Command 多选</p>
      <div className="flex gap-2"><Button type="button" className="h-8" disabled={saving} onClick={claim}>{saving ? "认领中…" : "确认认领"}</Button><Button type="button" variant="outline" className="h-8" onClick={() => setOpen(false)}>取消</Button></div>
      {message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
