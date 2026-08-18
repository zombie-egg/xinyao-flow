"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  businessLineText,
  customerNatures,
  customerStatusText,
  monitoringTypes,
} from "@/lib/customer-labels";
import { PublicCustomerClaim } from "./public-customer-claim";
import { Funnel } from "lucide-react";
import type { ReactNode } from "react";

function FilterHeader({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <th className="relative px-4 py-3 font-medium">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
          <span>{label}</span>
          <Funnel
            size={13}
            className={
              active
                ? "fill-orange-500 text-orange-500"
                : "text-zinc-400 group-open:text-zinc-900"
            }
          />
        </summary>
        <div className="absolute left-2 top-[calc(100%-4px)] z-30 w-56 rounded-xl border bg-white p-3 font-normal text-zinc-900 shadow-xl">
          {children}
          <div className="mt-3 flex gap-2">
            <button className="h-8 rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white">
              筛选
            </button>
            <Link
              href="/customers"
              className="inline-flex h-8 items-center rounded-lg border px-3 text-xs"
            >
              清除
            </Link>
          </div>
        </div>
      </details>
    </th>
  );
}

type SalesUser = { id: string; name: string };
type Customer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string | null;
  contactInfo: string | null;
  remark: string | null;
  businessLine:
    | "ENVIRONMENTAL_MONITORING"
    | "PUBLIC_HEALTH"
    | "OCCUPATIONAL_HEALTH";
  category: "XINYAO_ENVIRONMENT" | "OCCUPATIONAL_HEALTH";
  monitoringType: string | null;
  industry: string;
  status: string;
  nature: string | null;
  owner: { id: string; name: string } | null;
  pendingOwnerName: string | null;
  isPublicPool: boolean;
  collaborators: { user: SalesUser }[];
  contactMethods: { id: string; label: string | null; value: string }[];
};

function CustomerFields({
  customer,
  salesUsers,
  canAssignOwner,
  canManageCollaborators = true,
  showScope = false,
}: {
  customer?: Customer;
  salesUsers: SalesUser[];
  canAssignOwner: boolean;
  canManageCollaborators?: boolean;
  showScope?: boolean;
}) {
  const [category, setCategory] = useState<"XINYAO_ENVIRONMENT" | "OCCUPATIONAL_HEALTH">(
    customer?.category || "XINYAO_ENVIRONMENT",
  );
  const allowedBusinessLines: Customer["businessLine"][] = category === "XINYAO_ENVIRONMENT"
    ? ["ENVIRONMENTAL_MONITORING"]
    : ["PUBLIC_HEALTH", "OCCUPATIONAL_HEALTH"];
  const initialBusinessLine = customer?.businessLine && allowedBusinessLines.includes(customer.businessLine)
    ? customer.businessLine
    : allowedBusinessLines[0];
  const [businessLine, setBusinessLine] = useState<typeof initialBusinessLine>(initialBusinessLine);
  const [contacts, setContacts] = useState(
    customer?.contactMethods
      .filter((item) => item.label !== "电话" || item.value !== customer.phone)
      .map((item) => ({ label: item.label || "其他", value: item.value })) ||
      [],
  );
  const selectedCollaborators = new Set(
    customer?.collaborators.map((item) => item.user.id) || [],
  );
  const [customerScope, setCustomerScope] = useState<"TRACKED" | "PUBLIC">(
    customer?.isPublicPool ? "PUBLIC" : "TRACKED",
  );
  return (
    <>
      <label className="text-sm md:col-span-2">
        <span className="text-red-500">* </span>客户模板
        <select
          name="category"
          value={category}
          onChange={(event) => {
            const nextCategory = event.target.value as typeof category;
            setCategory(nextCategory);
            setBusinessLine(nextCategory === "XINYAO_ENVIRONMENT" ? "ENVIRONMENTAL_MONITORING" : "OCCUPATIONAL_HEALTH");
          }}
          className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
          required
        >
          <option value="XINYAO_ENVIRONMENT">心邀环境</option>
          <option value="OCCUPATIONAL_HEALTH">职业卫生</option>
        </select>
      </label>
      {showScope && (
        <label className="text-sm md:col-span-2">
          <span className="text-red-500">* </span>客户归属
          <select
            name="customerScope"
            value={customerScope}
            onChange={(event) =>
              setCustomerScope(event.target.value as "TRACKED" | "PUBLIC")
            }
            className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
          >
            <option value="TRACKED">跟进客户</option>
            <option value="PUBLIC">公海客户</option>
          </select>
          <span className="mt-1 block text-xs text-zinc-400">
            公海客户无需负责人，所有销售、财务和管理员均可查看。
          </span>
        </label>
      )}
      <label className="text-sm">
        <span className="text-red-500">* </span>业务线
        <select
          name="businessLine"
          value={businessLine}
          onChange={(event) =>
            setBusinessLine(event.target.value as typeof businessLine)
          }
          className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
        >
          {allowedBusinessLines.map((value) => <option key={value} value={value}>{value === "ENVIRONMENTAL_MONITORING" ? "环境检测" : value === "PUBLIC_HEALTH" ? "公共卫生" : "职业卫生"}</option>)}
        </select>
      </label>
      {businessLine === "ENVIRONMENTAL_MONITORING" && (
        <label className="text-sm">
          <span className="text-red-500">* </span>环境检测类型
          <select
            name="monitoringType"
            required
            defaultValue={customer?.monitoringType || "验收检测"}
            className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
          >
            {monitoringTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm">
        <span className="text-red-500">* </span>客户名称
        <Input
          name="name"
          defaultValue={customer?.name}
          className="mt-2"
          required
        />
      </label>
      <label className="text-sm">
        <span className="text-red-500">* </span>客户行业
        <Input
          name="industry"
          defaultValue={customer?.industry}
          className="mt-2"
          required
        />
      </label>
      <label className="text-sm">
        <span className="text-red-500">* </span>联系人
        <Input
          name="contact"
          defaultValue={customer?.contact}
          className="mt-2"
          required
        />
      </label>
      <label className="text-sm">
        <span className="text-red-500">* </span>联系电话
        <Input
          name="phone"
          defaultValue={customer?.phone}
          className="mt-2"
          required
        />
      </label>
      <label className="text-sm">
        客户状态
        <select
          name="status"
          defaultValue={customer?.status || "POTENTIAL"}
          className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
        >
          {Object.entries(customerStatusText).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        客户性质
        <select
          name="nature"
          defaultValue={customer?.nature || "普通客户"}
          className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
        >
          {customerNatures.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="text-sm md:col-span-2">
        地址
        <Input
          name="address"
          defaultValue={customer?.address || ""}
          className="mt-2"
        />
      </label>
      <label className="text-sm md:col-span-2">
        其他联系信息
        <Input
          name="contactInfo"
          defaultValue={customer?.contactInfo || ""}
          className="mt-2"
        />
      </label>
      <div className="space-y-2 md:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">更多联系方式</span>
          <Button
            type="button"
            variant="outline"
            className="h-8"
            onClick={() =>
              setContacts([...contacts, { label: "其他", value: "" }])
            }
          >
            添加联系方式
          </Button>
        </div>
        {contacts.map((item, index) => (
          <div key={index} className="grid grid-cols-[130px_1fr_auto] gap-2">
            <Input
              value={item.label}
              onChange={(e) =>
                setContacts(
                  contacts.map((x, i) =>
                    i === index ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
              placeholder="类型"
            />
            <Input
              value={item.value}
              onChange={(e) =>
                setContacts(
                  contacts.map((x, i) =>
                    i === index ? { ...x, value: e.target.value } : x,
                  ),
                )
              }
              placeholder="联系方式"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setContacts(contacts.filter((_, i) => i !== index))
              }
            >
              删除
            </Button>
          </div>
        ))}
        <input
          type="hidden"
          name="contactMethodsJson"
          value={JSON.stringify(contacts.filter((item) => item.value.trim()))}
        />
      </div>
      {canAssignOwner && customerScope === "TRACKED" && (
        <label className="text-sm">
          负责销售
          <select
            name="salesUserId"
            defaultValue={customer?.owner?.id || ""}
            required
            className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
          >
            <option value="" disabled>
              请选择负责销售
            </option>
            {salesUsers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {customerScope === "TRACKED" &&
        (canManageCollaborators ? (
          <label className="text-sm">
            客户协同跟进人
            <select
              name="collaboratorIds"
              multiple
              defaultValue={[...selectedCollaborators]}
              className="mt-2 min-h-28 w-full rounded-lg border bg-white p-3"
            >
              {salesUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-zinc-400">
              非必填；未选择时该客户没有协同跟进人。电脑可按住 Ctrl/Command 多选
            </span>
          </label>
        ) : (
          <div className="text-sm">
            <span className="block">客户协同跟进人</span>
            <div className="mt-2 min-h-10 rounded-lg border bg-zinc-50 px-3 py-2 text-zinc-600">
              {customer?.collaborators
                .map((item) => item.user.name)
                .join("、") || "无"}
            </div>
          </div>
        ))}
      <label className="text-sm md:col-span-2">
        备注
        <Input
          name="remark"
          defaultValue={customer?.remark || ""}
          className="mt-2"
        />
      </label>
    </>
  );
}

export function CustomerManager({
  items,
  currentUserId,
  salesUsers,
  canAssignOwner,
  canClaimPublic,
  returnTo,
  params,
}: {
  items: Customer[];
  currentUserId: string;
  salesUsers: SalesUser[];
  canAssignOwner: boolean;
  canClaimPublic: boolean;
  returnTo?: string;
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [show, setShow] = useState(Boolean(returnTo));
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicateQuery, setDuplicateQuery] = useState("");
  const [duplicates, setDuplicates] = useState<Customer[]>([]);
  const editing = items.find((item) => item.id === editingId);

  useEffect(() => {
    const toggleCreate = () => {
      setShow((value) => !value);
      setShowDuplicates(false);
      setEditingId(null);
    };
    const toggleDuplicates = () => {
      setShowDuplicates((value) => !value);
      setShow(false);
      setEditingId(null);
    };
    window.addEventListener("customer:toggle-create", toggleCreate);
    window.addEventListener("customer:toggle-duplicates", toggleDuplicates);
    return () => {
      window.removeEventListener("customer:toggle-create", toggleCreate);
      window.removeEventListener(
        "customer:toggle-duplicates",
        toggleDuplicates,
      );
    };
  }, []);

  function payload(form: HTMLFormElement) {
    const data = new FormData(form);
    const collaboratorIds = data.getAll("collaboratorIds").map(String);
    const contactMethods = JSON.parse(
      String(data.get("contactMethodsJson") || "[]"),
    );
    return {
      ...Object.fromEntries(data.entries()),
      collaboratorIds,
      contactMethods,
    };
  }
  async function save(event: React.FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch(id ? `/api/customers/${id}` : "/api/customers", {
        method: id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload(event.currentTarget)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.code === "CUSTOMER_DUPLICATES") {
          try {
            setDuplicates(JSON.parse(body.message));
          } catch {}
          setShowDuplicates(true);
          setMessage("发现重复客户，请先核对下面的查重结果");
        } else {
          setMessage(body.message || `保存失败（${res.status}）`);
        }
        return;
      }
      if (returnTo)
        router.push(
          `${returnTo}${returnTo.includes("?") ? "&" : "?"}customerId=${body.data.id}`,
        );
      else {
        setShow(false);
        setEditingId(null);
        setMessage(id ? "客户信息已更新" : "客户创建成功");
        router.refresh();
      }
    } catch {
      setMessage("保存失败，请检查网络连接后重试");
    } finally {
      setSaving(false);
    }
  }
  async function checkDuplicates() {
    const res = await fetch(
      `/api/customers/duplicates?q=${encodeURIComponent(duplicateQuery)}`,
    );
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    setDuplicates(body.data);
    setMessage(
      body.data.length
        ? `发现 ${body.data.length} 条可能重复客户`
        : "未发现重复客户",
    );
  }
  return (
    <>
      {showDuplicates && (
        <Card id="duplicate-search" className="mb-5">
          <h2 className="font-medium">全库客户查重</h2>
          <div className="mt-3 flex gap-2">
            <Input
              value={duplicateQuery}
              onChange={(e) => setDuplicateQuery(e.target.value)}
              placeholder="输入客户名称、联系人、电话、微信、邮箱或其他联系信息"
            />
            <Button type="button" onClick={checkDuplicates}>
              查重
            </Button>
          </div>
          {duplicates.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {duplicates.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  href={`/customers/${item.id}`}
                  className="rounded-lg border p-3 text-sm hover:bg-zinc-50"
                >
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-1 text-zinc-500">
                    {item.contact} · {item.phone} · 负责销售：
                    {item.owner?.name || "公海池"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
      {show && (
        <Card className="mb-5">
          <h2 className="mb-4 font-medium">新建客户</h2>
          <form onSubmit={(e) => save(e)} className="grid gap-4 md:grid-cols-2">
            <CustomerFields
              salesUsers={salesUsers}
              canAssignOwner={canAssignOwner}
              showScope
            />
            <div className="md:col-span-2">
              <Button disabled={saving}>{saving ? "保存中..." : "保存客户"}</Button>
              {message && <p className="self-center text-sm text-red-600">{message}</p>}
            </div>
          </form>
        </Card>
      )}
      {editing && (
        <Card className="mb-5">
          <h2 className="mb-4 font-medium">编辑客户</h2>
          <form
            onSubmit={(e) => save(e, editing.id)}
            className="grid gap-4 md:grid-cols-2"
          >
            <CustomerFields
              customer={editing}
              salesUsers={salesUsers}
              canAssignOwner={false}
              canManageCollaborators={
                canAssignOwner || editing.owner?.id === currentUserId
              }
            />
            <div className="md:col-span-2 flex gap-2">
              <Button disabled={saving}>{saving ? "保存中..." : "保存修改"}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingId(null)}
              >
                取消
              </Button>
              {message && <p className="self-center text-sm text-red-600">{message}</p>}
            </div>
          </form>
        </Card>
      )}
      <form>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[1600px] whitespace-nowrap text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <FilterHeader label="客户名称" active={Boolean(params.customerName)}><Input name="customerName" defaultValue={params.customerName} placeholder="输入客户名称关键词" className="h-9 text-xs" /></FilterHeader>
              <FilterHeader label="客户模板" active={Boolean(params.category)}><select name="category" defaultValue={params.category || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部模板</option><option value="XINYAO_ENVIRONMENT">心邀环境</option><option value="OCCUPATIONAL_HEALTH">职业卫生</option></select></FilterHeader>
              <FilterHeader label="业务线" active={Boolean(params.businessLine)}><select name="businessLine" defaultValue={params.businessLine || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部业务线</option><option value="ENVIRONMENTAL_MONITORING">环境检测</option><option value="PUBLIC_HEALTH">公共卫生</option><option value="OCCUPATIONAL_HEALTH">职业卫生</option></select></FilterHeader>
              <FilterHeader label="行业" active={Boolean(params.industry)}><Input name="industry" defaultValue={params.industry} placeholder="输入行业关键词" className="h-9 text-xs" /></FilterHeader>
              <FilterHeader label="联系人" active={Boolean(params.contactQuery)}><Input name="contactQuery" defaultValue={params.contactQuery} placeholder="输入联系人关键词" className="h-9 text-xs" /></FilterHeader>
              <FilterHeader label="联系电话" active={Boolean(params.phoneQuery)}><Input name="phoneQuery" defaultValue={params.phoneQuery} placeholder="输入电话关键词" className="h-9 text-xs" /></FilterHeader>
              <FilterHeader label="负责销售" active={Boolean(params.ownerId)}><select name="ownerId" defaultValue={params.ownerId || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部销售</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterHeader>
              <FilterHeader label="协同跟进人" active={Boolean(params.collaboratorId)}><select name="collaboratorId" defaultValue={params.collaboratorId || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部协同人</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterHeader>
              <FilterHeader label="客户状态" active={Boolean(params.customerStatus)}><select name="customerStatus" defaultValue={params.customerStatus || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部状态</option>{Object.entries(customerStatusText).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></FilterHeader>
              <FilterHeader label="客户性质" active={Boolean(params.nature)}><select name="nature" defaultValue={params.nature || ""} className="h-9 w-full rounded-lg border bg-white px-2 text-xs"><option value="">全部客户性质</option>{customerNatures.map((item) => <option key={item} value={item}>{item}</option>)}</select></FilterHeader>
              <th className="sticky right-0 z-20 w-[260px] min-w-[260px] border-l bg-zinc-50 px-3 py-3 font-medium shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.35)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const salesCanOperate =
                !item.isPublicPool &&
                (item.owner?.id === currentUserId ||
                  item.collaborators.some((x) => x.user.id === currentUserId));
              const canEdit =
                !item.isPublicPool && (canAssignOwner || salesCanOperate);
              return (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-4 font-medium">{item.name}</td>
                  <td className="px-4">{item.category === "OCCUPATIONAL_HEALTH" ? "职业卫生" : "心邀环境"}</td>
                  <td className="px-4">
                    {businessLineText[item.businessLine]}
                  </td>
                  <td className="px-4">{item.industry}</td>
                  <td className="px-4">{item.contact}</td>
                  <td className="px-4">{item.phone}</td>
                  <td className="px-4">
                    {item.owner?.name ||
                      (item.pendingOwnerName ? (
                        <Badge>{item.pendingOwnerName}（待注册）</Badge>
                      ) : (
                        <Badge>公海池</Badge>
                      ))}
                  </td>
                  <td className="px-4">
                    {item.collaborators.map((x) => x.user.name).join("、") ||
                      "—"}
                  </td>
                  <td className="px-4">
                    <Badge>
                      {item.isPublicPool
                        ? "公海客户"
                        : customerStatusText[item.status]}
                    </Badge>
                  </td>
                  <td className="px-4">{item.nature || "—"}</td>
                  <td className="sticky right-0 z-10 w-[260px] min-w-[260px] border-l bg-white px-3 shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.2)]">
                    <div className="flex flex-nowrap gap-2 whitespace-nowrap">
                      <Link
                        href={`/customers/${item.id}`}
                        className="inline-flex h-8 items-center rounded-lg border px-3"
                      >
                        查看明细
                      </Link>
                      {item.isPublicPool ? (
                        canClaimPublic ? (
                          <PublicCustomerClaim
                            customerId={item.id}
                            salesUsers={salesUsers}
                          />
                        ) : null
                      ) : (
                        <>
                          {salesCanOperate && (
                            <Link
                              href={`/orders/new?customerId=${item.id}`}
                              className="inline-flex h-8 items-center rounded-lg bg-zinc-950 px-3 text-white"
                            >
                              新建订单
                            </Link>
                          )}
                          {canEdit && (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8"
                              onClick={() => setEditingId(item.id)}
                            >
                              编辑
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </form>
      {message && <p className="mt-3 text-sm text-zinc-500">{message}</p>}
    </>
  );
}
