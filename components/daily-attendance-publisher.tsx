"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { LogIn, LogOut } from "lucide-react";
export function DailyAttendancePublisher({
  requireCheckIn,
  requireCheckOut,
}: {
  requireCheckIn: boolean;
  requireCheckOut: boolean;
}) {
  const router = useRouter(),
    [loading, setLoading] = useState<string | null>(null),
    [message, setMessage] = useState("");
  async function publish(action: "CHECK_IN" | "CHECK_OUT") {
    const label = action === "CHECK_IN" ? "签到" : "签退";
    if (!confirm(`确认发布今日${label}任务到所有员工？`)) return;
    setLoading(action);
    const res = await fetch("/api/attendance/requirements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      }),
      body = await res.json();
    setLoading(null);
    setMessage(res.ok ? `今日${label}任务已发布给所有员工` : body.message);
    if (res.ok) router.refresh();
  }
  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">今日签到签退发布</h2>
          <p className="mt-1 text-sm text-zinc-500">
            未发布的项目默认正常出勤；发布后须在规定的签到或签退时间窗内完成。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => publish("CHECK_IN")}
            disabled={requireCheckIn || loading !== null}
          >
            <LogIn className="mr-2" size={17} />
            {requireCheckIn
              ? "今日签到已发布"
              : loading === "CHECK_IN"
                ? "发布中…"
                : "发布今日签到"}
          </Button>
          <Button
            onClick={() => publish("CHECK_OUT")}
            disabled={requireCheckOut || loading !== null}
            variant="outline"
          >
            <LogOut className="mr-2" size={17} />
            {requireCheckOut
              ? "今日签退已发布"
              : loading === "CHECK_OUT"
                ? "发布中…"
                : "发布今日签退"}
          </Button>
        </div>
      </div>
      {message && <p className="mt-3 text-sm text-zinc-500">{message}</p>}
    </Card>
  );
}
