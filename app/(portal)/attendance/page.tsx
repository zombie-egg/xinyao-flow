import Link from "next/link";
import { PageHeader, Empty } from "@/components/page";
import { AttendancePanel } from "@/components/attendance-panel";
import { AttendanceRecords } from "@/components/attendance-records";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { startOfChinaDay } from "@/lib/utils";
export default async function Attendance({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const u = await requirePermission("attendance:self"),
    params = await searchParams,
    selected = ["LATE", "EARLY_LEAVE"].includes(params.type || "")
      ? params.type
      : null,
    setting = await db.companySetting.findUnique({ where: { id: "company" } });
  if (setting?.latitude == null || setting.longitude == null)
    return (
      <>
        <PageHeader title="我的考勤" description="公司尚未设置真实考勤位置" />
        <Card className="mx-auto max-w-xl text-center">
          <h2 className="text-lg font-semibold">未配置公司真实位置</h2>
          <p className="mt-2 text-sm text-zinc-500">
            系统已移除默认坐标。在管理员设置真实位置前，不允许签到。
          </p>
          {u.role.code === "ADMIN" && (
            <Link
              href="/settings"
              className="mt-5 inline-flex h-10 items-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
            >
              前往设置真实位置
            </Link>
          )}
        </Card>
      </>
    );
  const today = startOfChinaDay(),
    chinaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
    }).format(new Date()),
    month = new Date(`${chinaToday}-01T00:00:00+08:00`),
    [rows, current, requirement, exceptions] = await Promise.all([
      db.attendance.findMany({ where: { userId: u.id, date: { gte: month } } }),
      db.attendance.findUnique({
        where: { userId_date: { userId: u.id, date: today } },
      }),
      db.dailyAttendanceRequirement.findUnique({ where: { date: today } }),
      selected
        ? db.attendanceException.findMany({
            where: {
              attendance: {
                userId: u.id,
                date: { gte: month },
                status: { not: "LEAVE" },
              },
              type: selected as "LATE" | "EARLY_LEAVE",
            },
            include: { attendance: true },
            orderBy: { attendance: { date: "desc" } },
          })
        : Promise.resolve([]),
    ]),
    items = [
      [
        "本月出勤",
        rows.filter(
          (x) =>
            !x.excludedFromStats && x.status === "ON_TIME" && !x.isEarlyLeave,
        ).length,
        null,
      ],
      [
        "迟到次数",
        rows.filter((x) => !x.excludedFromStats && x.isLate).length,
        "LATE",
      ],
      [
        "早退次数",
        rows.filter((x) => !x.excludedFromStats && x.isEarlyLeave).length,
        "EARLY_LEAVE",
      ],
    ] as const;
  return (
    <>
      <PageHeader
        title="我的考勤"
        description="管理员未发布的签到或签退项目默认无需操作并按正常出勤处理"
      />
      <AttendancePanel
        radius={setting.attendanceRadius}
        workStart={setting.workStart}
        workEnd={setting.workEnd}
        company={{ latitude: setting.latitude, longitude: setting.longitude }}
        requireCheckIn={Boolean(requirement?.requireCheckIn)}
        requireCheckOut={Boolean(requirement?.requireCheckOut)}
        checkInPublishedAt={
          requirement?.checkInPublishedAt?.toISOString() || null
        }
        checkOutPublishedAt={
          requirement?.checkOutPublishedAt?.toISOString() || null
        }
        checkInDurationMinutes={requirement?.checkInDurationMinutes || 20}
        checkOutDurationMinutes={requirement?.checkOutDurationMinutes || 20}
        initialCheckedIn={Boolean(current?.checkInTime)}
        initialCheckedOut={Boolean(current?.checkOutTime)}
      />
      <div className="mx-auto mt-5 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map(([label, value, type]) =>
          type ? (
            <Link key={label} href={`/attendance?type=${type}`}>
              <Card
                className={`h-full transition hover:border-zinc-400 ${selected === type ? "border-zinc-950 ring-1 ring-zinc-950" : ""}`}
              >
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
                <p className="mt-2 text-xs text-zinc-400">点击查看并填写原因</p>
              </Card>
            </Link>
          ) : (
            <Card key={label}>
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </Card>
          ),
        )}
      </div>
      {selected && (
        <section className="mx-auto mt-7 max-w-5xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">
              {selected === "LATE" ? "迟到" : "早退"}
              记录与原因
            </h2>
            <Link
              href="/attendance"
              className="text-sm text-zinc-500 underline"
            >
              收起
            </Link>
          </div>
          {exceptions.length ? (
            <AttendanceRecords
              items={exceptions.map((x) => ({
                id: x.id,
                date: x.attendance.date.toISOString(),
                type: x.type,
                reason: x.reason,
                status: x.status,
                disposition: x.disposition,
                checkInTime: x.attendance.checkInTime?.toISOString() || null,
                checkOutTime: x.attendance.checkOutTime?.toISOString() || null,
              }))}
            />
          ) : (
            <Empty text="本月暂无相关记录" />
          )}
        </section>
      )}
    </>
  );
}
