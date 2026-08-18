"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function CustomerReleaseToPool({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function release() {
    if (!window.confirm("确认将该客户放入公海池？当前负责人和全部协同跟进人都会被清除，其他销售可以重新认领。"))
      return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/customers/${customerId}/pool`, {
      method: "POST",
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(body.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" disabled={saving} onClick={release}>
        {saving ? "处理中…" : "放入公海池"}
      </Button>
      {message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
