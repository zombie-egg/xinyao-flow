import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page";
import { money } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export default async function Dashboard() {
  const user = await requireUser();
  const role = user.role.code;
  const scopeSql = role === "SALES_MANAGER"
    ? Prisma.sql`EXISTS (SELECT 1 FROM "User" su WHERE su."id" = o."salesUserId" AND su."departmentId" = ${user.departmentId})`
    : role === "SALES_EMPLOYEE"
      ? Prisma.sql`(o."salesUserId" = ${user.id} OR EXISTS (SELECT 1 FROM "CustomerCollaborator" cc WHERE cc."customerId" = o."customerId" AND cc."userId" = ${user.id}))`
      : role === "TECH_MANAGER"
        ? Prisma.sql`o."historicalSalesName" IS NULL AND o."approvalStatus" = 'APPROVED'::"OrderApprovalStatus"`
        : role === "TECH_EMPLOYEE"
          ? Prisma.sql`o."historicalSalesName" IS NULL AND o."approvalStatus" = 'APPROVED'::"OrderApprovalStatus" AND o."technicalUserId" = ${user.id}`
          : Prisma.sql`TRUE`;
  const nowText = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const [year, month] = nowText.split("-");
  const monthStart = new Date(`${year}-${month}-01T00:00:00+08:00`);
  const nextMonth = new Date(Number(year), Number(month), 1);
  const monthEnd = new Date(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01T00:00:00+08:00`);
  const yearStart = new Date(`${year}-01-01T00:00:00+08:00`);
  const yearEnd = new Date(`${Number(year) + 1}-01-01T00:00:00+08:00`);
  const [summaryRows, leaves] = await Promise.all([
    db.$queryRaw<Array<{ monthCount: bigint; monthAmount: Prisma.Decimal; yearCount: bigint; yearAmount: Prisma.Decimal; processing: bigint; completed: bigint }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE o."createdAt" >= ${monthStart} AND o."createdAt" < ${monthEnd}) AS "monthCount",
        COALESCE(SUM(o."amount") FILTER (WHERE o."createdAt" >= ${monthStart} AND o."createdAt" < ${monthEnd}), 0) AS "monthAmount",
        COUNT(*) FILTER (WHERE o."createdAt" >= ${yearStart} AND o."createdAt" < ${yearEnd}) AS "yearCount",
        COALESCE(SUM(o."amount") FILTER (WHERE o."createdAt" >= ${yearStart} AND o."createdAt" < ${yearEnd}), 0) AS "yearAmount",
        COUNT(*) FILTER (WHERE o."status" <> 'COMPLETED'::"OrderStatus" AND o."paymentStatus" <> 'COMPLETED'::"ProcessStatus") AS "processing",
        COUNT(*) FILTER (WHERE o."status" = 'COMPLETED'::"OrderStatus" OR o."paymentStatus" = 'COMPLETED'::"ProcessStatus") AS "completed"
      FROM "Order" o WHERE ${scopeSql}
    `),
    db.leaveRequest.count({ where: role === "ADMIN" ? { status: "PENDING_ADMIN" } : { userId: user.id } }),
  ]);
  const summary = summaryRows[0];
  const monthCount = Number(summary?.monthCount || 0);
  const yearCount = Number(summary?.yearCount || 0);
  const processing = Number(summary?.processing || 0);
  const completed = Number(summary?.completed || 0);
  const cards = [
    { label: "本月订单量", value: monthCount, href: `/orders?status=ALL&createdFromMode=month&createdFromValue=${year}-${month}&createdToMode=month&createdToValue=${year}-${month}` },
    { label: "本月订单金额", value: money(Number(summary?.monthAmount || 0)), href: `/orders?status=ALL&createdFromMode=month&createdFromValue=${year}-${month}&createdToMode=month&createdToValue=${year}-${month}` },
    { label: "本年订单量", value: yearCount, href: `/orders?status=ALL&createdFromMode=year&createdFromValue=${year}&createdToMode=year&createdToValue=${year}` },
    { label: "本年订单金额", value: money(Number(summary?.yearAmount || 0)), href: `/orders?status=ALL&createdFromMode=year&createdFromValue=${year}&createdToMode=year&createdToValue=${year}` },
    { label: "处理中订单", value: processing, href: "/orders?status=PROCESSING" },
    { label: "已完成订单", value: completed, href: "/orders?status=COMPLETED" },
  ];
  return <>
    <PageHeader title={`早上好，${user.name}`} description="按本月、本年快速查看订单情况；点击卡片可进入对应订单明细" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((item) => <Link key={item.label} href={item.href}><Card className="h-full transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-sm"><p className="text-sm text-zinc-500">{item.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p><p className="mt-4 text-xs text-zinc-400">点击查看具体订单 →</p></Card></Link>)}</div>
    <Card className="mt-5"><h2 className="font-medium">业务提醒</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><Link href="/orders?status=PROCESSING" className="rounded-lg bg-zinc-50 p-4 text-sm">待推进订单 <strong className="ml-2">{processing}</strong></Link><Link href={role === "ADMIN" ? "/approvals" : "/leave"} className="rounded-lg bg-zinc-50 p-4 text-sm">请假与审批 <strong className="ml-2">{leaves}</strong></Link><Link href="/customers" className="rounded-lg bg-zinc-50 p-4 text-sm">进入客户管理 →</Link></div></Card>
  </>;
}
