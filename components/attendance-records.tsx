"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
type RecordItem = {
  id: string;
  date: string;
  type: string;
  reason: string | null;
  status: string;
  disposition: string;
  checkInTime: string | null;
  checkOutTime: string | null;
};
const typeText: Record<string, string> = {
    LATE: "迟到",
    EARLY_LEAVE: "早退",
    ABSENT: "迟到且早退",
  },
  dispositionText: Record<string, string> = {
    PENDING: "等待考勤处理",
    ARCHIVED: "已归档并计入",
    EXEMPT: "已免除，不计入",
  };
export function AttendanceRecords({ items }: { items: RecordItem[] }) {
  const router = useRouter(),
    [saving, setSaving] = useState<string | null>(null),
    [message, setMessage] = useState<{ id: string; text: string } | null>(null);
  async function save(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(id);
    setMessage(null);
    const reason = String(new FormData(e.currentTarget).get("reason") || ""),
      res = await fetch(`/api/attendance-exceptions/${id}/reason`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
      body = await res.json();
    setSaving(null);
    setMessage({ id, text: res.ok ? "原因已提交" : body.message });
    if (res.ok) router.refresh();
  }
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const canExplain = ["PENDING_MANAGER", "PENDING_ADMIN"].includes(
            item.status,
          ),
          displayDisposition = canExplain ? "PENDING" : item.disposition;
        return (
          <Card key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {new Date(item.date).toLocaleDateString("zh-CN")} ·{" "}
                  {typeText[item.type]}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  签到：
                  {item.checkInTime
                    ? new Date(item.checkInTime).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}{" "}
                  · 签退：
                  {item.checkOutTime
                    ? new Date(item.checkOutTime).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>
              <Badge
                className={
                  displayDisposition === "EXEMPT"
                    ? "bg-emerald-50 text-emerald-700"
                    : ""
                }
              >
                {dispositionText[displayDisposition]}
              </Badge>
            </div>
            <form
              onSubmit={(e) => save(item.id, e)}
              className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <Input
                name="reason"
                defaultValue={item.reason || ""}
                placeholder="填写迟到或早退原因"
                className="min-w-0"
                disabled={!canExplain}
              />
              <Button
                className="w-full sm:w-auto"
                disabled={saving === item.id || !canExplain}
              >
                {saving === item.id
                  ? "提交中…"
                  : item.reason
                    ? "更新原因"
                    : "提交原因"}
              </Button>
            </form>
            {message?.id === item.id && (
              <p className="mt-2 text-xs text-zinc-500">{message.text}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
