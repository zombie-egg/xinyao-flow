"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

type Activity = {
  id: string;
  content: string;
  createdAt: Date | string;
  author: { name: string };
};
type Customer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string | null;
  contactInfo: string | null;
  remark: string | null;
  customerType: "WON" | "POTENTIAL";
  owner: { id: string; name: string };
  activities: Activity[];
};

export function CustomerManager({
  items,
  canCreate,
  currentUserId,
  salesUsers,
  returnTo,
}: {
  items: Customer[];
  canCreate: boolean;
  currentUserId: string;
  salesUsers: { id: string; name: string }[];
  returnTo?: string;
}) {
  const router = useRouter(),
    [show, setShow] = useState(Boolean(returnTo)),
    [message, setMessage] = useState(""),
    [openId, setOpenId] = useState<string | null>(null),
    [editingId, setEditingId] = useState<string | null>(null),
    [savingId, setSavingId] = useState<string | null>(null);
  const editingCustomer = items.find((item) => item.id === editingId);
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [router]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    try {
      const f = new FormData(e.currentTarget),
        res = await fetch("/api/customers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(Object.fromEntries(f.entries())),
        }),
        body = await res.json();
      if (!res.ok) {
        setMessage(body.message || "保存失败，请检查填写内容");
        return;
      }
      if (returnTo) {
        router.push(returnTo);
        router.refresh();
        return;
      }
      setMessage("客户创建成功");
      setShow(false);
      router.refresh();
    } catch {
      setMessage("网络或服务器响应异常，请稍后重试");
    }
  }
  async function addActivity(
    customerId: string,
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();
    setSavingId(customerId);
    const form = e.currentTarget,
      content = String(new FormData(form).get("content") || ""),
      res = await fetch(`/api/customers/${customerId}/activities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      }),
      body = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    form.reset();
    setMessage("客户流水已添加");
    router.refresh();
  }
  async function updateCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingCustomer) return;
    setSavingId(editingCustomer.id);
    setMessage("");
    const form = e.currentTarget,
      res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      }),
      body = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    setEditingId(null);
    setMessage("客户信息已更新");
    router.refresh();
  }
  return (
    <>
      {canCreate && (
        <div className="mb-5 flex justify-end">
          <Button onClick={() => setShow(!show)}>
            {show ? "取消" : "新建客户"}
          </Button>
        </div>
      )}
      {show && (
        <Card className="mb-5">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <Input name="name" placeholder="客户名称" required />
            <Input name="contact" placeholder="联系人" required />
            <Input name="phone" placeholder="联系电话" required />
            <Input
              name="contactInfo"
              placeholder="其他联系方式（微信、邮箱等）"
            />
            <Input
              name="address"
              placeholder="地址"
              className="md:col-span-2"
            />
            <Input
              name="remark"
              placeholder="备注（不填写项目需求）"
              className="md:col-span-2"
            />
            {salesUsers.length > 0 && (
              <label className="text-sm md:col-span-2">
                负责销售
                <select
                  name="salesUserId"
                  required
                  defaultValue=""
                  className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
                >
                  <option value="" disabled>
                    请选择负责销售
                  </option>
                  {salesUsers.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="md:col-span-2">
              <Button>保存客户</Button>
              {message && (
                <span className="ml-3 text-sm text-zinc-500">{message}</span>
              )}
            </div>
          </form>
        </Card>
      )}
      {editingCustomer && (
        <Card className="mb-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-medium">编辑客户信息</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingId(null)}
            >
              取消
            </Button>
          </div>
          <form onSubmit={updateCustomer} className="grid gap-4 md:grid-cols-2">
            <Input name="name" defaultValue={editingCustomer.name} required />
            <Input
              name="contact"
              defaultValue={editingCustomer.contact}
              required
            />
            <Input name="phone" defaultValue={editingCustomer.phone} required />
            <Input
              name="contactInfo"
              defaultValue={editingCustomer.contactInfo || ""}
              placeholder="其他联系方式（微信、邮箱等）"
            />
            <Input
              name="address"
              defaultValue={editingCustomer.address || ""}
              placeholder="地址"
              className="md:col-span-2"
            />
            <Input
              name="remark"
              defaultValue={editingCustomer.remark || ""}
              placeholder="备注（不填写项目需求）"
              className="md:col-span-2"
            />
            <div className="md:col-span-2">
              <Button disabled={savingId === editingCustomer.id}>
                {savingId === editingCustomer.id ? "保存中…" : "保存修改"}
              </Button>
              {message && (
                <span className="ml-3 text-sm text-zinc-500">{message}</span>
              )}
            </div>
          </form>
        </Card>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[1150px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              {[
                "客户名称",
                "联系人",
                "联系电话",
                "其他联系方式",
                "地址",
                "负责销售",
                "客户分类",
                "客户流水",
                "操作",
              ].map((x) => (
                <th key={x} className="whitespace-nowrap px-4 py-3 font-medium">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t align-top">
                <td className="px-4 py-4 font-medium">{c.name}</td>
                <td className="px-4 py-4">{c.contact}</td>
                <td className="px-4 py-4">{c.phone}</td>
                <td className="px-4 py-4">{c.contactInfo || "—"}</td>
                <td className="px-4 py-4">{c.address || "—"}</td>
                <td className="whitespace-nowrap px-4 py-4">{c.owner.name}</td>
                <td className="whitespace-nowrap px-4 py-4">
                  <Badge
                    className={
                      c.customerType === "WON"
                        ? "bg-emerald-50 text-emerald-700"
                        : ""
                    }
                  >
                    {c.customerType === "WON" ? "成交客户" : "潜在客户"}
                  </Badge>
                </td>
                <td className="px-4 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 min-w-[5.5rem] px-3"
                    onClick={() => setOpenId(openId === c.id ? null : c.id)}
                  >
                    {openId === c.id ? "收起流水" : "查看流水"}
                  </Button>
                  {openId === c.id && (
                    <div className="mt-3 w-[360px] max-w-[70vw] space-y-3">
                      {c.owner.id === currentUserId && (
                        <form
                          onSubmit={(e) => addActivity(c.id, e)}
                          className="space-y-2"
                        >
                          <textarea
                            name="content"
                            required
                            maxLength={5000}
                            placeholder="记录跟进、沟通、回访等客户事件"
                            className="min-h-24 w-full rounded-lg border p-3 text-sm"
                          />
                          <Button disabled={savingId === c.id}>
                            {savingId === c.id ? "添加中…" : "添加流水"}
                          </Button>
                        </form>
                      )}
                      <div className="max-h-72 space-y-2 overflow-y-auto">
                        {c.activities.length ? (
                          c.activities.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-lg bg-zinc-50 p-3"
                            >
                              <p className="whitespace-pre-wrap leading-5">
                                {a.content}
                              </p>
                              <p className="mt-2 text-xs text-zinc-400">
                                {a.author.name} ·{" "}
                                {new Date(a.createdAt).toLocaleString("zh-CN")}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-zinc-400">暂无客户流水</p>
                        )}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  {c.owner.id === currentUserId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-3"
                      onClick={() => {
                        setShow(false);
                        setEditingId(c.id);
                        setMessage("");
                      }}
                    >
                      编辑
                    </Button>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && !show && (
        <p className="mt-3 text-sm text-zinc-500">{message}</p>
      )}
    </>
  );
}
