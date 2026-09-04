"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type State = "loading" | "unauthenticated" | "authenticated";

export default function HomePageGate() {
  const [state, setState] = useState<State>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => {
        if (res.ok) return res.json();
        return { ok: false };
      })
      .then((data) => setState(data?.ok ? "authenticated" : "unauthenticated"))
      .catch(() => setState("unauthenticated"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Login failed");
        return;
      }
      setState("authenticated");
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 pb-[env(safe-area-inset-bottom)]">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-xs space-y-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Crowdsource Choir" className="mx-auto h-14 w-auto" />
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-[#CFFF81] focus:outline-none focus:ring-1 focus:ring-[#CFFF81]/40"
              placeholder="Enter password"
              required
              disabled={submitting}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl border border-transparent bg-white px-4 py-3 text-base font-medium text-gray-900 transition-colors hover:border-[#CFFF81] hover:bg-white disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="pt-2 text-center">
            <Link href="/reset-root-password" className="text-sm text-gray-400 hover:text-gray-200 hover:underline">
              Forgot password? Reset
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 pb-[env(safe-area-inset-bottom)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Crowdsource Choir" className="h-16 w-auto" />
      <Link
        href="/admin/gardens"
        className="mt-6 min-h-[48px] min-w-[48px] rounded-xl border border-transparent bg-white px-6 py-3 text-base font-medium text-gray-900 transition-colors hover:border-[#CFFF81]"
      >
        {"Let's Go!"}
      </Link>
    </div>
  );
}
