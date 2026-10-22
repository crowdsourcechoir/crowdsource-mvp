"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

function InviteForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not accept invite.");
      window.location.href = data.home || "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <form onSubmit={onSubmit} className="w-full max-w-xs space-y-4">
        <h1 className="text-xl font-semibold">Choose a password</h1>
        <p className="text-sm text-gray-400">At least 8 characters. After this you land in the rooms you were invited to.</p>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-gray-100 focus:border-[var(--csc-accent)] focus:outline-none"
          placeholder="Password"
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button type="submit" disabled={busy || !token} className="w-full rounded-xl bg-white px-4 py-3 font-medium text-black disabled:opacity-50">
          {busy ? "Saving…" : "Save and enter"}
        </button>
        {!token ? <p className="text-sm text-red-300">Open the invite link from your email.</p> : null}
      </form>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteForm />
    </Suspense>
  );
}
