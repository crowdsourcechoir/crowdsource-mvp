"use client";

import { useState } from "react";

export default function PitchPasswordGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sobeca-song-garden/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("That password did not match.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Could not check the password.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-white">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <img src="/sobeca-song-garden/logo.png" alt="Crowdsource Choir" className="mx-auto mb-8 h-10 w-auto" />
        <h1 className="text-2xl font-bold">SoBECA Song Garden</h1>
        <p className="mt-2 text-sm text-white/70">Enter the password to view this page.</p>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(event) => setPassword(event.target.value)}
          className="mt-6 w-full border border-white/20 bg-black px-3 py-3 text-white focus:border-[#CFFF81] focus:outline-none"
          aria-label="Password"
        />
        {error ? <p className="mt-3 text-sm text-[#CFFF81]">{error}</p> : null}
        <button
          type="submit"
          disabled={sending || !password.trim()}
          className="mt-4 rounded-full border border-[#CFFF81] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#CFFF81] hover:bg-[#CFFF81] hover:text-black disabled:opacity-50"
        >
          {sending ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
