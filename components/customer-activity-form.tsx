"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function CustomerActivityForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") || "");
    const res = await fetch(`/api/customers/${customerId}/activities`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) });
    const body = await res.json();
    if (!res.ok) { setMessage(body.message); return; }
    form.reset(); setMessage("流水已添加"); router.refresh();
  }
  return <form onSubmit={submit} className="mt-4 space-y-2"><textarea name="content" required maxLength={5000} placeholder="记录跟进、沟通、回访等客户事件" className="min-h-24 w-full rounded-lg border p-3 text-sm"/><Button>添加流水</Button>{message && <span className="ml-3 text-sm text-zinc-500">{message}</span>}</form>;
}
