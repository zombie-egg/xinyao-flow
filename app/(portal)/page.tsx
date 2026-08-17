import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page";
import { money } from "@/lib/utils";

export default async function Dashboard() {
  const user = await requireUser();
  const role = user.role.code;
  const orderScope = role === "SALES_MANAGER"
    ? { salesUser: { departmentId: user.departmentId } }
    : role === "SALES_EMPLOYEE"
      ? { OR: [{ salesUserId: user.id }, { customer: { collaborators: { some: { userId: user.id } } } }] }
      : role === "TECH_MANAGER"
        ? { approvalStatus: "APPROVED" as const }
        : role === "TECH_EMPLOYEE"
          ? { approvalStatus: "APPROVED" as const, technicalUserId: user.id }
          : {};
  const nowText = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const [year, month] = nowText.split("-");
  const monthStart = new Date(`${year}-${month}-01T00:00:00+08:00`);
  const nextMonth = new Date(Number(year), Number(month), 1);
  const monthEnd = new Date(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01T00:00:00+08:00`);
  const yearStart = new Date(`${year}-01-01T00:00:00+08:00`);
  const yearEnd = new Date(`${Number(year) + 1}-01-01T00:00:00+08:00`);
  const monthWhere = { AND: [orderScope, { createdAt: { gte: monthStart, lt: monthEnd } }] };
  const yearWhere = { AND: [orderScope, { createdAt: { gte: yearStart, lt: yearEnd } }] };
  const [monthCount, monthAmount, yearCount, yearAmount, processing, completed, leaves] = await Promise.all([
    db.order.count({ where: monthWhere }),
    db.order.aggregate({ where: monthWhere, _sum: { amount: true } }),
    db.order.count({ where: yearWhere }),
    db.order.aggregate({ where: yearWhere, _sum: { amount: true } }),
    db.order.count({ where: { AND: [orderScope, { status: { not: "COMPLETED" } }, { paymentStatus: { not: "COMPLETED" } }] } }),
    db.order.count({ where: { AND: [orderScope, { OR: [{ status: "COMPLETED" }, { paymentStatus: "COMPLETED" }] }] } }),
    db.leaveRequest.count({ where: role === "ADMIN" ? { status: "PENDING_ADMIN" } : { userId: user.id } }),
  ]);
  const cards = [
    { label: "本月订单量", value: monthCount, href: `/orders?status=ALL&createdFromMode=month&createdFromValue=${year}-${month}&createdToMode=month&createdToValue=${year}-${month}` },
    { label: "本月订单金额", value: money(Number(monthAmount._sum.amount || 0)), href: `/orders?status=ALL&createdFromMode=month&createdFromValue=${year}-${month}&createdToMode=month&createdToValue=${year}-${month}` },
    { label: "本年订单量", value: yearCount, href: `/orders?status=ALL&createdFromMode=year&createdFromValue=${year}&createdToMode=year&createdToValue=${year}` },
    { label: "本年订单金额", value: money(Number(yearAmount._sum.amount || 0)), href: `/orders?status=ALL&createdFromMode=year&createdFromValue=${year}&createdToMode=year&createdToValue=${year}` },
    { label: "处理中订单", value: processing, href: "/orders?status=PROCESSING" },
    { label: "已完成订单", value: completed, href: "/orders?status=COMPLETED" },
  ];
  return <>
    <PageHeader title={`早上好，${user.name}`} description="按本月、本年快速查看订单情况；点击卡片可进入对应订单明细" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((item) => <Link key={item.label} href={item.href}><Card className="h-full transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-sm"><p className="text-sm text-zinc-500">{item.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p><p className="mt-4 text-xs text-zinc-400">点击查看具体订单 →</p></Card></Link>)}</div>
    <Card className="mt-5"><h2 className="font-medium">业务提醒</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><Link href="/orders?status=PROCESSING" className="rounded-lg bg-zinc-50 p-4 text-sm">待推进订单 <strong className="ml-2">{processing}</strong></Link><Link href={role === "ADMIN" ? "/approvals" : "/leave"} className="rounded-lg bg-zinc-50 p-4 text-sm">请假与审批 <strong className="ml-2">{leaves}</strong></Link><Link href="/customers" className="rounded-lg bg-zinc-50 p-4 text-sm">进入客户管理 →</Link></div></Card>
  </>;
}
