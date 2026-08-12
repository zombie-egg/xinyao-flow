"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function CustomerCollaboratorPicker({
  customerId,
  salesUsers,
  initialIds,
}: {
  customerId: string;
  salesUsers: { id: string; name: string }[];
  initialIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initialIds);
  const [message, setMessage] = useState("");
  async function save() {
    const res = await fetch(`/api/customers/${customerId}/collaborators`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ collaboratorIds: selected }),
    });
    const body = await res.json();
    if (!res.ok) { setMessage(body.message); return; }
    setMessage("已保存");
    setOpen(false);
    router.refresh();
  }
  return (
    <div className="relative">
      <Button type="button" variant="outline" className="h-8" onClick={() => setOpen(!open)}>
        选择协同人
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-white p-3 shadow-lg">
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {salesUsers.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />
                {item.name}
              </label>
            ))}
          </div>
          <Button type="button" className="mt-3 h-8 w-full" onClick={save}>保存协同销售</Button>
          {message && <p className="mt-2 text-xs text-zinc-500">{message}</p>}
        </div>
      )}
    </div>
  );
}
