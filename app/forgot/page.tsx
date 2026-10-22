"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send reset email.");
      setMessage(data.message || "If that email has an account, a reset link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <form onSubmit={onSubmit} className="w-full max-w-xs space-y-4">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="text-sm text-gray-400">Enter the email on your account. We will send a one-hour link.</p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-gray-100 focus:border-[var(--csc-accent)] focus:outline-none"
          placeholder="Email"
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-white px-4 py-3 font-medium text-black disabled:opacity-50">
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/" className="csc-link block text-center text-sm">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
