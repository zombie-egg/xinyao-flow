"use client";
import { useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { LocationMap } from "./location-map";
import { haversineMeters } from "@/lib/utils";
import {
  getBrowserLocation,
  locationErrorMessage,
} from "@/lib/browser-location";
import {
  LocateFixed,
  RefreshCw,
  ShieldCheck,
  LogIn,
  LogOut,
} from "lucide-react";
type Point = { latitude: number; longitude: number; accuracy: number };
export function AttendancePanel({
  radius,
  workStart,
  workEnd,
  company,
  requireCheckIn,
  requireCheckOut,
  initialCheckedIn,
  initialCheckedOut,
}: {
  radius: number;
  workStart: string;
  workEnd: string;
  company: { latitude: number; longitude: number };
  requireCheckIn: boolean;
  requireCheckOut: boolean;
  initialCheckedIn: boolean;
  initialCheckedOut: boolean;
}) {
  const [message, setMessage] = useState(
      !requireCheckIn && !requireCheckOut
        ? "管理员今日未发布签到或签退，默认正常出勤"
        : "请读取设备位置后完成管理员发布的任务",
    ),
    [loading, setLoading] = useState<string | null>(null),
    [position, setPosition] = useState<Point | null>(null),
    [checkedIn, setCheckedIn] = useState(initialCheckedIn),
    [checkedOut, setCheckedOut] = useState(initialCheckedOut);
  const distance = useMemo(
    () => (position ? Math.round(haversineMeters(position, company)) : null),
    [position, company],
  );
  async function locate() {
    setLoading("location");
    setMessage("正在读取设备真实位置…");
    try {
      const point = await getBrowserLocation(setMessage);
      setPosition(point);
      const meters = Math.round(haversineMeters(point, company));
      setMessage(
        meters <= radius
          ? `真实定位成功，距离公司 ${meters} 米`
          : `真实定位成功，距离公司 ${meters} 米，超出 ${radius} 米有效范围`,
      );
    } catch (e) {
      setMessage(locationErrorMessage(e));
    } finally {
      setLoading(null);
    }
  }
  async function submit(mode: "check-in" | "check-out") {
    if (!position) {
      await locate();
      return;
    }
    setLoading(mode);
    const res = await fetch(`/api/attendance/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(position),
      }),
      body = await res.json();
    setLoading(null);
    if (!res.ok) {
      setMessage(body.message);
      return;
    }
    if (mode === "check-in") {
      setCheckedIn(true);
      setMessage(
        `签到成功，状态：${body.data.status === "LATE" ? "迟到" : "准时"}`,
      );
    } else {
      setCheckedOut(true);
      setMessage(
        body.data.isEarlyLeave ? "签退成功，本次记录为早退" : "签退成功",
      );
    }
  }
  const outOfRange = Boolean(
      position && distance !== null && distance > radius,
    ),
    allDone =
      (!requireCheckIn || checkedIn) && (!requireCheckOut || checkedOut);
  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <Card className="overflow-hidden p-2">
        <LocationMap company={company} current={position} radius={radius} />
        <div className="flex items-center justify-between gap-3 px-3 py-3 text-xs text-zinc-500">
          <span>黑色：公司真实范围 · 蓝色：设备返回位置</span>
          <span>
            定位精度 {position ? `±${Math.round(position.accuracy)}m` : "—"}
          </span>
        </div>
      </Card>
      <Card className="flex flex-col justify-center text-center">
        <p className="text-sm text-zinc-500">今天 · 工作时间</p>
        <p className="mt-2 text-3xl font-semibold">
          {workStart} — {workEnd}
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          签到：上班前 1 小时至上班时间 · 签退：下班时间至下班后 1 小时
        </p>
        <div className="mt-4 flex justify-center gap-2 text-xs">
          <span
            className={`rounded-full px-3 py-1 ${requireCheckIn ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}
          >
            {requireCheckIn ? "今日需要签到" : "今日无需签到"}
          </span>
          <span
            className={`rounded-full px-3 py-1 ${requireCheckOut ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}
          >
            {requireCheckOut ? "今日需要签退" : "今日无需签退"}
          </span>
        </div>
        {distance !== null && (
          <div
            className={`mx-auto mt-5 rounded-full px-4 py-2 text-sm font-medium ${distance <= radius ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
          >
            距离公司 {distance} 米 · {distance <= radius ? "范围内" : "范围外"}
          </div>
        )}
        <div className="mt-7 space-y-3">
          {!position && (requireCheckIn || requireCheckOut) && (
            <Button
              type="button"
              onClick={locate}
              disabled={loading !== null}
              className="h-12 w-full"
            >
              {loading === "location" ? (
                <>
                  <RefreshCw className="mr-2 animate-spin" size={18} />
                  读取位置中…
                </>
              ) : (
                <>
                  <LocateFixed className="mr-2" size={18} />
                  读取设备真实位置
                </>
              )}
            </Button>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {requireCheckIn && (
              <Button
                type="button"
                onClick={() => submit("check-in")}
                disabled={loading !== null || checkedIn || outOfRange}
                variant={checkedIn ? "outline" : "default"}
              >
                {checkedIn ? (
                  <>
                    <ShieldCheck className="mr-2" size={17} />
                    已签到
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2" size={17} />
                    {loading === "check-in" ? "签到中…" : "确认签到"}
                  </>
                )}
              </Button>
            )}
            {requireCheckOut && (
              <Button
                type="button"
                onClick={() => submit("check-out")}
                disabled={loading !== null || checkedOut || outOfRange}
                variant={checkedOut ? "outline" : "default"}
              >
                {checkedOut ? (
                  <>
                    <ShieldCheck className="mr-2" size={17} />
                    已签退
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2" size={17} />
                    {loading === "check-out" ? "签退中…" : "确认签退"}
                  </>
                )}
              </Button>
            )}
          </div>
          {position && !allDone && (
            <Button
              type="button"
              variant="ghost"
              onClick={locate}
              disabled={loading !== null}
              className="w-full"
            >
              <RefreshCw className="mr-2" size={16} />
              重新读取位置
            </Button>
          )}
        </div>
        <p className="mt-5 text-sm text-zinc-500">{message}</p>
      </Card>
    </div>
  );
}
