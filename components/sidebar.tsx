"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  ShoppingCart,
  Users,
  Settings,
  BarChart3,
  UserRound,
  ClipboardCheck,
  LogOut,
  PanelLeft,
  ContactRound,
  CalendarDays,
  Clock3,
  Wrench,
  ReceiptText,
  WalletCards,
  Trophy,
  Archive,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
const menus = {
  ADMIN: [
    ["/", "工作台", LayoutDashboard],
    ["/attendance", "我的考勤", Clock3],
    ["/customers", "客户管理", ContactRound],
    ["/reviews", "合同审核", ClipboardCheck],
    ["/approvals", "请假审批", CalendarDays],
    ["/attendance-processing", "考勤处理", Archive],
    ["/orders", "订单管理", ShoppingCart],
    ["/employees", "员工管理", Users],
    ["/performance", "数据统计", Trophy],
    ["/statistics", "财务统计", BarChart3],
    ["/settings", "系统设置", Settings],
    ["/me", "我的", UserRound],
  ],
  SALES_EMPLOYEE: [
    ["/", "工作台", LayoutDashboard],
    ["/attendance", "我的考勤", Clock3],
    ["/leave", "请假申请", CalendarDays],
    ["/customers", "客户管理", ContactRound],
    ["/employees", "员工名单", Users],
    ["/orders/new", "新建订单", FilePlus2],
    ["/orders", "我的订单", ShoppingCart],
    ["/performance", "我的业绩", Trophy],
    ["/me", "我的", UserRound],
  ],
  SALES_MANAGER: [
    ["/", "工作台", LayoutDashboard],
    ["/attendance", "我的考勤", Clock3],
    ["/leave", "请假申请", CalendarDays],
    ["/approvals", "请假审批", CalendarDays],
    ["/attendance-processing", "考勤处理", Archive],
    ["/employees", "员工名单", Users],
    ["/customers", "客户管理", ContactRound],
    ["/orders/new", "新建订单", FilePlus2],
    ["/orders", "订单管理", ShoppingCart],
    ["/reviews", "合同审核", ClipboardCheck],
    ["/performance", "我的业绩", Trophy],
    ["/me", "我的", UserRound],
  ],
  TECH_EMPLOYEE: [
    ["/attendance", "我的考勤", Clock3],
    ["/leave", "请假申请", CalendarDays],
    ["/tasks", "订单任务", Wrench],
    ["/orders", "订单查询", ShoppingCart],
    ["/customers", "客户管理", ContactRound],
    ["/me", "我的", UserRound],
  ],
  TECH_MANAGER: [
    ["/attendance", "我的考勤", Clock3],
    ["/leave", "请假申请", CalendarDays],
    ["/approvals", "请假审批", CalendarDays],
    ["/attendance-processing", "考勤处理", Archive],
    ["/employees", "员工管理", Users],
    ["/tasks", "订单任务", Wrench],
    ["/orders", "订单查询", ShoppingCart],
    ["/customers", "客户管理", ContactRound],
    ["/me", "我的", UserRound],
  ],
  FINANCE_EMPLOYEE: [
    ["/", "工作台", LayoutDashboard],
    ["/attendance", "我的考勤", Clock3],
    ["/reviews", "合同审核", ClipboardCheck],
    ["/leave", "请假申请", CalendarDays],
    ["/orders", "订单管理", ShoppingCart],
    ["/finance/invoices", "发票待办", ReceiptText],
    ["/finance/payments", "回款待办", WalletCards],
    ["/performance", "销售业绩", Trophy],
    ["/statistics", "财务统计", BarChart3],
    ["/customers", "客户管理", ContactRound],
    ["/me", "我的", UserRound],
  ],
  FINANCE_MANAGER: [
    ["/", "工作台", LayoutDashboard],
    ["/attendance", "我的考勤", Clock3],
    ["/reviews", "合同审核", ClipboardCheck],
    ["/leave", "请假申请", CalendarDays],
    ["/orders", "订单管理", ShoppingCart],
    ["/finance/invoices", "发票待办", ReceiptText],
    ["/finance/payments", "回款待办", WalletCards],
    ["/performance", "销售业绩", Trophy],
    ["/statistics", "财务统计", BarChart3],
    ["/customers", "客户管理", ContactRound],
    ["/me", "我的", UserRound],
  ],
} as const;
export function Sidebar({
  user,
  company,
  badges,
}: {
  user: {
    name: string;
    avatarUrl: string | null;
    jobTitle: string;
    permissions: string[];
    role: string;
  };
  company: { name: string; logoUrl: string | null };
  badges: Record<string, number>;
}) {
  const path = usePathname(),
    router = useRouter(),
    [open, setOpen] = useState(false),
    [todoBadges, setTodoBadges] = useState(badges),
    items = menus[user.role as keyof typeof menus] || menus.ADMIN;
  useEffect(() => {
    const update = async () => {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const body = await res.json();
        setTodoBadges(body.data);
      }
    };
    const timer = window.setInterval(update, 15000);
    return () => window.clearInterval(timer);
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 rounded-lg border bg-white p-2 lg:hidden"
      >
        <PanelLeft size={20} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r bg-white p-4 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-2 py-3">
          {company.logoUrl ? (
            <Image
              src={company.logoUrl}
              alt={company.name}
              width={40}
              height={40}
              unoptimized
              className="size-10 rounded-xl object-cover"
            />
          ) : (
            <div className="grid size-10 place-items-center rounded-xl bg-zinc-950 text-sm font-bold text-white">
              企
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{company.name}</p>
            <p className="text-xs text-zinc-400">业务管理系统</p>
          </div>
        </div>
        <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {items.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100",
                path === href && "bg-zinc-950 text-white hover:bg-zinc-900",
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {todoBadges[href] > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-5 text-white">
                  {todoBadges[href] > 99 ? "99+" : todoBadges[href]}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t pt-4">
          <Link
            href="/me"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-50"
          >
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.name}
                width={36}
                height={36}
                unoptimized
                className="size-9 rounded-full object-cover"
              />
            ) : (
              <div className="grid size-9 place-items-center rounded-full bg-zinc-100 text-sm font-medium">
                {user.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-zinc-400">{user.jobTitle}</p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                void logout();
              }}
              title="退出登录"
            >
              <LogOut size={17} />
            </button>
          </Link>
        </div>
      </aside>
    </>
  );
}
