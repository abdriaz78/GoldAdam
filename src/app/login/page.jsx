"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      toast.success("Welcome back");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-panel p-6">
        <div>
          <div className="font-serif text-2xl font-semibold text-gold">Goldroute</div>
          <p className="mt-1 text-sm text-muted">Sign in to continue</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-text">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-[#161C25] px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-gold-dim"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-text">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-[#161C25] px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-gold-dim"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gold py-2 text-sm font-semibold text-[#1A1305] hover:bg-[#d4ad5a] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
