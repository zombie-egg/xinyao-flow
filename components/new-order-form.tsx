"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";

type Customer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string | null;
  contactInfo: string | null;
};
type Staff = {
  id: string;
  name: string;
  employeeNumber: string | null;
  department: { code: string; name: string } | null;
  role: { code: string };
};
const groups = [
  ["ALL", "全部人员"],
  ["ADMIN", "管理员"],
  ["FINANCE", "财务部"],
  ["SALES", "销售部"],
  ["TECH", "技术部"],
] as const;
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="mr-1 text-red-500">*</span>
      {children}
    </>
  );
}
function StaffSelector({
  name,
  label,
  staff,
}: {
  name: string;
  label: string;
  staff: Staff[];
}) {
  const [group, setGroup] = useState("ALL");
  const [selectedId, setSelectedId] = useState("");
  const filtered = staff.filter((x) =>
    group === "ALL"
      ? true
      : group === "ADMIN"
        ? x.role.code === "ADMIN"
        : x.department?.code === group,
  );
  return (
    <label className="text-sm">
      <RequiredLabel>{label}</RequiredLabel>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            setSelectedId("");
          }}
          className="h-10 rounded-lg border bg-white px-3"
        >
          <option value="ALL">全部人员</option>
          {groups.slice(1).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <select
          name={name}
          required
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-10 rounded-lg border bg-white px-3"
        >
          <option value="" disabled>
            请选择{label}
          </option>
          {filtered.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
              {x.employeeNumber ? ` · ${x.employeeNumber}` : ""}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export function NewOrderForm({
  customers,
  staff,
  employeeNumber,
}: {
  customers: Customer[];
  staff: Staff[];
  employeeNumber: string | null;
}) {
  const router = useRouter(),
    [customerId, setCustomerId] = useState(customers[0]?.id || ""),
    [customerSearch, setCustomerSearch] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [amounts, setAmounts] = useState({
      amount: "",
      technicalSupportFee: "0",
      outsourcingFee: "0",
      reviewFee: "0",
      otherExpense: "0",
    }),
    selected = customers.find((c) => c.id === customerId),
    visible = customers.filter((c) =>
      `${c.name}${c.contact}${c.phone}`
        .toLowerCase()
        .includes(customerSearch.toLowerCase()),
    ),
    netAmount = useMemo(
      () =>
        Number(amounts.amount || 0) -
        Number(amounts.technicalSupportFee || 0) -
        Number(amounts.outsourcingFee || 0) -
        Number(amounts.reviewFee || 0) -
        Number(amounts.otherExpense || 0),
      [amounts],
    );
  function amountInput(
    name: keyof typeof amounts,
    label: string,
    required = false,
  ) {
    return (
      <label className="text-sm">
        {required ? <RequiredLabel>{label}</RequiredLabel> : label}
        <Input
          name={name}
          type="number"
          min="0"
          step="0.01"
          value={amounts[name]}
          onChange={(e) => setAmounts({ ...amounts, [name]: e.target.value })}
          className="mt-2"
          required={required}
        />
      </label>
    );
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) {
      setMessage("请先选择或创建客户");
      return;
    }
    if (!employeeNumber) {
      setMessage("管理员尚未设置您的销售工号，暂时不能创建合同");
      return;
    }
    setLoading(true);
    const form = new FormData(e.currentTarget);
    form.set("customerId", customerId);
    const res = await fetch("/api/orders", { method: "POST", body: form }),
      body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    router.push(`/orders/${body.data.id}`);
    router.refresh();
  }
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Shanghai",
  });
  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <h2 className="font-medium">第一步：客户与业务信息</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <RequiredLabel>业务类型</RequiredLabel>
            <select
              name="businessType"
              required
              defaultValue="ENVIRONMENTAL_MONITORING"
              className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
            >
              <option value="ENVIRONMENTAL_MONITORING">环境监测</option>
              <option value="PUBLIC_HEALTH">公共卫生</option>
            </select>
          </label>
          <label className="text-sm">
            <RequiredLabel>合同编号</RequiredLabel>
            <Input
              value={
                employeeNumber
                  ? `提交时自动生成：日期 + 流水号 + ${employeeNumber}`
                  : "请先设置销售工号"
              }
              readOnly
              className="mt-2 bg-zinc-50"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <RequiredLabel>客户名称</RequiredLabel>
            <Input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="搜索客户名称、联系人或电话"
              className="mt-2"
            />
            <div className="mt-2 flex flex-wrap gap-3">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="h-10 min-w-64 flex-1 rounded-lg border bg-white px-3"
              >
                <option value="">选择客户</option>
                {visible.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.contact} · {c.phone}
                  </option>
                ))}
              </select>
              <Link
                href="/customers?return=/orders/new"
                className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
              >
                客户不存在？创建客户
              </Link>
            </div>
          </label>
        </div>
        {selected && (
          <div className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
            <p>联系人：{selected.contact}</p>
            <p>电话：{selected.phone}</p>
            <p>地址：{selected.address || "—"}</p>
            <p>其他联系方式：{selected.contactInfo || "—"}</p>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="font-medium">第二步：金额与费用</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <RequiredLabel>产品合计</RequiredLabel>
            <Input
              name="productTotal"
              type="number"
              min="0.01"
              step="0.01"
              className="mt-2"
              required
            />
          </label>
          {amountInput("amount", "合同金额", true)}
          {amountInput("technicalSupportFee", "技术支持费用", true)}
          {amountInput("outsourcingFee", "外包费用", true)}
          {amountInput("reviewFee", "评审费用")}
          {amountInput("otherExpense", "其他支出")}
          <label className="text-sm">
            净签单金额
            <Input
              value={netAmount.toFixed(2)}
              readOnly
              className={`mt-2 bg-zinc-50 ${netAmount < 0 ? "text-red-600" : ""}`}
            />
          </label>
          <label className="text-sm">
            变更净签单金额的备用栏
            <Input
              name="adjustedNetAmount"
              type="number"
              min="0"
              step="0.01"
              className="mt-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            外包、评审、技术支持费明细备注
            <textarea
              name="expenseDetails"
              maxLength={3000}
              className="mt-2 min-h-24 w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label className="text-sm md:col-span-2">
            （原）技术支持/外包/评审费
            <textarea
              name="originalExpenseNote"
              maxLength={3000}
              className="mt-2 min-h-20 w-full rounded-lg border p-3 text-sm"
            />
          </label>
        </div>
      </Card>
      <Card>
        <h2 className="font-medium">第三步：合同与人员信息</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <RequiredLabel>订单名称</RequiredLabel>
            <Input name="name" className="mt-2" required />
          </label>
          <label className="text-sm">
            <RequiredLabel>合同状态</RequiredLabel>
            <select
              name="signingStatus"
              required
              defaultValue="SIGNED"
              className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
            >
              <option value="SIGNED">已签订</option>
              <option value="PENDING_SIGNATURE">待签订</option>
            </select>
          </label>
          <label className="text-sm">
            <RequiredLabel>签订日期</RequiredLabel>
            <Input
              name="contractDate"
              type="date"
              defaultValue={today}
              className="mt-2"
              required
            />
          </label>
          <div />
          <StaffSelector name="signerId" label="签订人" staff={staff} />
          <StaffSelector
            name="responsibleUserId"
            label="负责人"
            staff={staff}
          />
          <StaffSelector name="collaboratorId" label="协同人" staff={staff} />
          <label className="text-sm md:col-span-2">
            <RequiredLabel>项目需求</RequiredLabel>
            <textarea
              name="projectRequirements"
              className="mt-2 min-h-36 w-full rounded-lg border p-3 text-sm"
              required
            />
          </label>
          <label className="text-sm md:col-span-2">
            订单备注
            <textarea
              name="remark"
              className="mt-2 min-h-20 w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <RequiredLabel>合同附件</RequiredLabel>
            <Input
              name="contract"
              type="file"
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
              className="mt-2 h-auto py-2"
              required
            />
            <span className="mt-1 block text-xs text-zinc-500">
              支持 PDF、Word、JPG、PNG、WEBP，最大 10MB。
            </span>
          </label>
        </div>
        <div className="mt-5">
          <Button disabled={loading || netAmount < 0}>
            {loading ? "正在提交…" : "提交订单审核"}
          </Button>
          {message && (
            <span className="ml-3 text-sm text-zinc-500">{message}</span>
          )}
        </div>
      </Card>
    </form>
  );
}
