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
export type OrderFormInitial = {
  customerId: string;
  contractNumber: string | null;
  businessType: "ENVIRONMENTAL_MONITORING" | "PUBLIC_HEALTH";
  productTotal: number;
  amount: number;
  technicalSupportFee: number;
  outsourcingFee: number;
  reviewFee: number;
  otherExpense: number;
  adjustedNetAmount: number | null;
  expenseDetails: string | null;
  originalExpenseNote: string | null;
  name: string;
  signingStatus: "SIGNED" | "PENDING_SIGNATURE";
  contractDate: string;
  signerId: string | null;
  responsibleUserId: string | null;
  collaboratorId: string | null;
  projectRequirements: string;
  remark: string | null;
  receivable: {
    number: string;
    amount: number;
    expectedDate: string;
    paymentType: string | null;
    remark: string | null;
    responsibleUserId: string;
    collaboratorUserId: string | null;
  } | null;
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
  required = true,
  initialId = "",
}: {
  name: string;
  label: string;
  staff: Staff[];
  required?: boolean;
  initialId?: string | null;
}) {
  const [group, setGroup] = useState("ALL");
  const [selectedId, setSelectedId] = useState(initialId || "");
  const filtered = staff.filter((x) =>
    group === "ALL"
      ? true
      : group === "ADMIN"
        ? x.role.code === "ADMIN"
        : x.department?.code === group,
  );
  return (
    <label className="text-sm">
      {required ? <RequiredLabel>{label}</RequiredLabel> : label}
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
          required={required}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-10 rounded-lg border bg-white px-3"
        >
          <option value="" disabled={required}>
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

function FinanceSelector({
  name,
  staff,
  initialId = "",
}: {
  name: string;
  staff: Staff[];
  initialId?: string | null;
}) {
  const financeStaff = staff.filter(
    (item) => item.department?.code === "FINANCE" || item.role.code.startsWith("FINANCE"),
  );
  return (
    <label className="text-sm">
      <RequiredLabel>财务协同人</RequiredLabel>
      <select
        name={name}
        required
        defaultValue={initialId || ""}
        className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
      >
        <option value="" disabled>请选择财务人员</option>
        {financeStaff.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}{item.employeeNumber ? ` · ${item.employeeNumber}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NewOrderForm({
  customers,
  staff,
  employeeNumber,
  orderId,
  initial,
  initialCustomerId,
}: {
  customers: Customer[];
  staff: Staff[];
  employeeNumber: string | null;
  orderId?: string;
  initial?: OrderFormInitial;
  initialCustomerId?: string;
}) {
  const router = useRouter(),
    [customerId, setCustomerId] = useState(
      initial?.customerId || initialCustomerId || customers[0]?.id || "",
    ),
    [customerSearch, setCustomerSearch] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [showReceivable, setShowReceivable] = useState(true),
    [amounts, setAmounts] = useState({
      amount: initial ? String(initial.amount) : "",
      technicalSupportFee: String(initial?.technicalSupportFee ?? 0),
      outsourcingFee: String(initial?.outsourcingFee ?? 0),
      reviewFee: String(initial?.reviewFee ?? 0),
      otherExpense: String(initial?.otherExpense ?? 0),
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
      setMessage("系统尚未生成您的销售工号，请刷新页面或联系管理员");
      return;
    }
    setLoading(true);
    const form = new FormData(e.currentTarget);
    form.set("customerId", customerId);
    try {
      const res = await fetch(orderId ? `/api/orders/${orderId}` : "/api/orders", {
          method: orderId ? "PATCH" : "POST",
          body: form,
        }),
        body = await res.json();
      if (!res.ok) {
        setMessage(body.message || "提交失败，请检查填写内容");
        return;
      }
      router.push(`/orders/${body.data.id}`);
      router.refresh();
    } catch {
      setMessage("网络或服务器响应异常，请稍后重试");
    } finally {
      setLoading(false);
    }
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
                initial?.contractNumber
                  ? initial.contractNumber
                  : employeeNumber
                  ? `提交时自动生成：日期 + 流水号 + ${employeeNumber}`
                  : "等待系统生成销售工号"
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
              defaultValue={initial?.productTotal}
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
              defaultValue={initial?.adjustedNetAmount ?? ""}
            />
          </label>
          <label className="text-sm md:col-span-2">
            外包、评审、技术支持费明细备注
            <textarea
              name="expenseDetails"
              maxLength={3000}
              defaultValue={initial?.expenseDetails || ""}
              className="mt-2 min-h-24 w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label className="text-sm md:col-span-2">
            （原）技术支持/外包/评审费
            <textarea
              name="originalExpenseNote"
              maxLength={3000}
              defaultValue={initial?.originalExpenseNote || ""}
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
            <Input name="name" defaultValue={initial?.name} className="mt-2" required />
          </label>
          <label className="text-sm">
            <RequiredLabel>合同状态</RequiredLabel>
            <select
              name="signingStatus"
              required
              defaultValue={initial?.signingStatus || "SIGNED"}
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
              defaultValue={initial?.contractDate || today}
              className="mt-2"
              required
            />
          </label>
          <div />
          <StaffSelector name="signerId" label="签订人" staff={staff} initialId={initial?.signerId} />
          <StaffSelector
            name="responsibleUserId"
            label="负责人"
            staff={staff}
            initialId={initial?.responsibleUserId}
          />
          <FinanceSelector name="collaboratorId" staff={staff} initialId={initial?.collaboratorId} />
          <label className="text-sm md:col-span-2">
            <RequiredLabel>项目需求</RequiredLabel>
            <textarea
              name="projectRequirements"
              className="mt-2 min-h-36 w-full rounded-lg border p-3 text-sm"
              defaultValue={initial?.projectRequirements}
              required
            />
          </label>
          <label className="text-sm md:col-span-2">
            订单备注
            <textarea
              name="remark"
              defaultValue={initial?.remark || ""}
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
              required={!orderId}
            />
            <span className="mt-1 block text-xs text-zinc-500">
              支持 PDF、Word、JPG、PNG、WEBP，最大 10MB。
            </span>
          </label>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">第四步：应收款信息</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReceivable(!showReceivable)}
          >
            {showReceivable ? "收起应收款" : "填写应收款"}
          </Button>
        </div>
        <div className={showReceivable ? "block" : "hidden"}>
          <p className="mt-2 text-sm text-zinc-500">
            回款状态由系统根据财务登记的回款自动更新，无需手工填写。
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <RequiredLabel>编号</RequiredLabel>
            <Input
              value={initial?.receivable?.number || "PMO.提交后自动生成的订单号"}
              readOnly
              className="mt-2 bg-zinc-50"
            />
          </label>
          <label className="text-sm">
            <RequiredLabel>应收金额</RequiredLabel>
            <Input
              name="receivableAmount"
              type="number"
              min="0.01"
              step="0.01"
              className="mt-2"
              defaultValue={initial?.receivable?.amount}
              required
            />
          </label>
          <label className="text-sm">
            <RequiredLabel>预计回款日期</RequiredLabel>
            <Input
              name="receivableExpectedDate"
              type="date"
              min={orderId ? undefined : today}
              defaultValue={initial?.receivable?.expectedDate || today}
              className="mt-2"
              required
            />
          </label>
          <label className="text-sm">
            回款类型
            <select
              name="receivablePaymentType"
              defaultValue={initial?.receivable?.paymentType || ""}
              className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
            >
              <option value="">请选择</option>
              <option value="对公转账">对公转账</option>
              <option value="现金">现金</option>
              <option value="支票">支票</option>
              <option value="其他">其他</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            备注
            <Input
              name="receivableRemark"
              placeholder="填写应收款备注"
              className="mt-2"
              defaultValue={initial?.receivable?.remark || ""}
            />
          </label>
          <StaffSelector
            name="receivableResponsibleUserId"
            label="负责人"
            staff={staff}
            initialId={initial?.receivable?.responsibleUserId}
          />
          <StaffSelector
            name="receivableCollaboratorUserId"
            label="协同人"
            staff={staff}
            required={false}
            initialId={initial?.receivable?.collaboratorUserId}
          />
          </div>
        </div>
        <div className="mt-5">
          <Button disabled={loading || netAmount < 0 || !showReceivable}>
            {loading
              ? "正在提交…"
              : orderId
                ? "保存修改并重新提交审核"
                : "提交订单审核"}
          </Button>
          {message && (
            <span className="ml-3 text-sm text-zinc-500">{message}</span>
          )}
        </div>
      </Card>
    </form>
  );
}
