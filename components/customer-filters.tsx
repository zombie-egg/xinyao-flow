import Link from "next/link";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { customerStatusText } from "@/lib/customer-labels";

export function CustomerFilters({
  params,
  salesUsers,
}: {
  params: Record<string, string | undefined>;
  salesUsers: { id: string; name: string }[];
}) {
  return (
    <form className="mb-5 rounded-xl border bg-white p-4">
      {params.return && <input type="hidden" name="return" value={params.return} />}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Input name="q" defaultValue={params.q} placeholder="搜索客户、联系人、联系方式或行业" />
        <select name="ownerId" defaultValue={params.ownerId || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部跟进人</option>{salesUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select name="customerStatus" defaultValue={params.customerStatus || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部客户状态</option>{Object.entries(customerStatusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <Input name="nature" defaultValue={params.nature} placeholder="客户性质" />
        <Input name="industry" defaultValue={params.industry} placeholder="客户行业" />
        <select name="businessLine" defaultValue={params.businessLine || ""} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">全部业务线</option><option value="ENVIRONMENTAL_MONITORING">环境监测</option><option value="PUBLIC_HEALTH">公共卫生</option></select>
        <Input name="createdFrom" type="date" defaultValue={params.createdFrom} title="创建时间起" />
        <Input name="createdTo" type="date" defaultValue={params.createdTo} title="创建时间止" />
        <Input name="updatedFrom" type="date" defaultValue={params.updatedFrom} title="更新时间起" />
        <Input name="updatedTo" type="date" defaultValue={params.updatedTo} title="更新时间止" />
      </div>
      <div className="mt-3 flex gap-2"><Button type="submit">筛选</Button><Link href="/customers" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm">清除筛选</Link></div>
    </form>
  );
}
