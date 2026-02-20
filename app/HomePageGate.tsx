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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0e] px-4 pb-[env(safe-area-inset-bottom)]">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0e] px-4 pb-[env(safe-area-inset-bottom)]">
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
              className="w-full rounded-xl border border-gray-600 bg-[#1a1a1a] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="Enter password"
              required
              disabled={submitting}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-white px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0e] px-4 pb-[env(safe-area-inset-bottom)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Crowdsource Choir" className="h-16 w-auto" />
      <Link
        href="/admin/events"
        className="mt-6 min-h-[48px] min-w-[48px] rounded-xl bg-white px-6 py-3 text-base font-medium text-gray-900 hover:bg-gray-200 active:bg-gray-300"
      >
        {"Let's Go!"}
      </Link>
    </div>
  );
}
