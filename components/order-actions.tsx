"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function ContractSigningStatusAction({ id, status }: { id: string; status: "SIGNED" | "PENDING_SIGNATURE" }) {
  const router = useRouter();
  const [value, setValue] = useState(status), [message, setMessage] = useState("");
  async function save() {
    const res = await fetch(`/api/orders/${id}/signing-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signingStatus: value }),
    });
    const body = await res.json();
    setMessage(res.ok ? "合同状态已更新" : body.message);
    if (res.ok) router.refresh();
  }
  return <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"><select value={value} onChange={(event) => setValue(event.target.value as typeof value)} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="PENDING_SIGNATURE">待签署</option><option value="SIGNED">已签署</option></select><Button type="button" onClick={save} disabled={value === status}>更新合同状态</Button>{message && <span className="text-sm text-zinc-500">{message}</span>}</div>;
}
export function RejectedOrderActions({ id }: { id: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function cancel() {
    if (!confirm("确定取消这个订单吗？取消后不能再次提交审核。")) return;
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.message || "取消失败");
      return;
    }
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-red-600">
        合同审核未通过，您可以修改后重新提交，或者取消该订单。
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/orders/${id}/edit`}
          className="inline-flex h-10 items-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
        >
          修改并重新提交
        </Link>
        <Button type="button" variant="outline" onClick={cancel}>
          取消订单
        </Button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
export function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  async function review(result: "APPROVE" | "REJECT") {
    const comment =
      result === "REJECT"
        ? prompt("请输入拒绝原因") || ""
        : prompt("审批意见（可选）") || "";
    if (result === "REJECT" && !comment) return;
    const res = await fetch(`/api/orders/${id}/review`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result, comment }),
      }),
      body = await res.json();
    if (!res.ok) alert(body.message);
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <Button onClick={() => review("APPROVE")} className="h-8 px-3">
        通过
      </Button>
      <Button
        onClick={() => review("REJECT")}
        variant="outline"
        className="h-8 px-3"
      >
        拒绝
      </Button>
    </div>
  );
}
export function AssignTechnical({
  id,
  employees,
  currentId,
  currentName,
}: {
  id: string;
  employees: { id: string; name: string }[];
  currentId: string | null;
  currentName?: string | null;
}) {
  const router = useRouter(),
    [userId, setUserId] = useState(employees[0]?.id || ""),
    [message, setMessage] = useState("");
  if (currentId)
    return (
      <div className="min-w-44 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        已分配{currentName ? `给：${currentName}` : ""}
      </div>
    );
  async function assign() {
    const res = await fetch(`/api/orders/${id}/assign`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ technicalUserId: userId }),
      }),
      body = await res.json();
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    setMessage("分配成功");
    router.refresh();
  }
  return (
    <div className="flex min-w-72 flex-col gap-2 sm:flex-row">
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="h-10 flex-1 rounded-lg border bg-white px-3 text-sm"
      >
        <option value="">选择技术员工</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <Button onClick={assign} disabled={!userId}>
        分配
      </Button>
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </div>
  );
}
export function TechnicalActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  async function act(action: "RECEIVE" | "COMPLETE") {
    const res = await fetch(`/api/orders/${id}/technical`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      }),
      body = await res.json();
    if (!res.ok) alert(body.message);
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      {status === "PENDING" && (
        <Button onClick={() => act("RECEIVE")}>接收订单</Button>
      )}
      {status === "PROCESSING" && (
        <Button onClick={() => act("COMPLETE")}>标记技术完成</Button>
      )}
    </div>
  );
}
export function InvoiceForm({ id }: { id: string }) {
  const router = useRouter(),
    [required, setRequired] = useState("YES"),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await fetch(`/api/orders/${id}/invoice`, {
        method: "POST",
        body: new FormData(e.currentTarget),
      }),
      body = await res.json();
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    setMessage("发票事项已完成");
    router.refresh();
  }
  function checkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size > 8 * 1024 * 1024) {
      e.target.value = "";
      setMessage("发票文件不能超过 8MB，请压缩后重试");
    } else setMessage("");
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <select
        name="required"
        value={required}
        onChange={(e) => setRequired(e.target.value)}
        className="h-10 w-full rounded-lg border bg-white px-3"
      >
        <option value="YES">需要开发票</option>
        <option value="NO">不开发票</option>
      </select>
      {required === "YES" && (
        <Input
          name="invoice"
          type="file"
          accept="image/jpeg,image/png,image/webp,.pdf"
          onChange={checkFile}
          required
        />
      )}
      <Input name="note" placeholder="发票备注" />
      <Button>完成发票处理</Button>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </form>
  );
}
export function InvoiceApplicationForm({ id }: { id: string }) {
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget,
      res = await fetch(`/api/orders/${id}/invoice-application`, {
        method: "POST",
        body: new FormData(form),
      }),
      body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    setMessage("开票申请已提交财务");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-zinc-500">
        上传开票资料并填写开票内容，提交后进入财务发票待办。
      </p>
      <Input
        name="invoiceInfo"
        type="file"
        accept="image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.xls,.xlsx"
        required
      />
      <textarea
        name="note"
        required
        maxLength={2000}
        placeholder="填写抬头、税号、金额、项目名称等开票内容和备注"
        className="min-h-24 w-full rounded-lg border p-3 text-sm"
      />
      <Button disabled={loading}>{loading ? "提交中…" : "申请开票"}</Button>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </form>
  );
}
export function PaymentForm({
  id,
  remaining,
}: {
  id: string;
  remaining: number;
}) {
  const router = useRouter(),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await fetch(`/api/orders/${id}/payments`, {
        method: "POST",
        body: new FormData(e.currentTarget),
      }),
      body = await res.json();
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    setMessage("回款已登记");
    e.currentTarget.reset();
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-zinc-500">
        剩余待回款：¥{remaining.toFixed(2)}
      </p>
      <Input
        name="amount"
        type="number"
        min="0.01"
        max={remaining}
        step="0.01"
        placeholder="本次回款金额"
        required
      />
      <Input name="reference" placeholder="流水号或票据编号" />
      <Input
        name="receipt"
        type="file"
        accept="image/jpeg,image/png,image/webp,.pdf"
        required
      />
      <Input name="note" placeholder="回款备注" />
      <Button>登记本次回款</Button>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </form>
  );
}
