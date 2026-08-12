"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({
  companyName,
  logoUrl,
}: {
  companyName: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"PASSWORD" | "CODE">("PASSWORD");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);

  async function sendCode() {
    if (!email) {
      setError("请先填写邮箱");
      return;
    }
    setSending(true);
    setError("");
    const res = await fetch("/api/auth/email-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, purpose: "LOGIN" }),
    });
    const body = await res.json();
    setSending(false);
    setError(res.ok ? "验证码已发送，请检查邮箱" : body.message);
    if (res.ok) setCooldown(60);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = mode === "PASSWORD"
      ? { mode, identifier: form.get("identifier"), password: form.get("password") }
      : { mode, identifier: form.get("email"), code: form.get("code") };
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-7">
          {logoUrl ? (
            <div className="relative mb-4 size-14 overflow-hidden rounded-xl bg-white">
              <Image
                src={logoUrl}
                alt={`${companyName} Logo`}
                fill
                priority
                unoptimized
                className="object-contain"
              />
            </div>
          ) : (
            <div className="mb-4 grid size-11 place-items-center rounded-xl bg-zinc-950 font-bold text-white">企</div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">欢迎回来</h1>
          <p className="mt-2 text-sm text-zinc-500">使用密码或邮箱验证码安全登录</p>
        </div>
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-sm">
          <button type="button" onClick={() => { setMode("PASSWORD"); setError(""); }} className={`rounded-lg px-3 py-2 ${mode === "PASSWORD" ? "bg-white font-medium shadow-sm" : "text-zinc-500"}`}>密码登录</button>
          <button type="button" onClick={() => { setMode("CODE"); setError(""); }} className={`rounded-lg px-3 py-2 ${mode === "CODE" ? "bg-white font-medium shadow-sm" : "text-zinc-500"}`}>验证码登录</button>
        </div>
        {mode === "PASSWORD" ? (
          <>
            <label className="text-sm font-medium">邮箱或账号</label>
            <Input name="identifier" autoComplete="username" className="mt-2" required />
            <label className="mt-5 block text-sm font-medium">密码</label>
            <Input name="password" type="password" autoComplete="current-password" className="mt-2" required />
          </>
        ) : (
          <>
            <label className="text-sm font-medium">已绑定邮箱</label>
            <Input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-2" required />
            <label className="mt-5 block text-sm font-medium">邮箱验证码</label>
            <div className="mt-2 flex gap-2">
              <Input name="code" inputMode="numeric" maxLength={6} placeholder="6位验证码" required />
              <Button type="button" variant="outline" onClick={sendCode} disabled={sending || cooldown > 0} className="shrink-0">{cooldown > 0 ? `${cooldown}秒` : sending ? "发送中…" : "获取验证码"}</Button>
            </div>
          </>
        )}
        {error && <p className={`mt-4 rounded-lg p-3 text-sm ${error.includes("已发送") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{error}</p>}
        <Button disabled={loading} className="mt-6 w-full">{loading ? "正在登录…" : mode === "CODE" ? "验证码登录" : "登录"}</Button>
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          <Link href="/register" className="text-zinc-500 hover:text-zinc-900">注册账户</Link>
          <span className="text-zinc-300">·</span>
          <Link href="/forgot-password" className="text-zinc-500 hover:text-zinc-900">找回密码</Link>
        </div>
      </form>
    </main>
  );
}
