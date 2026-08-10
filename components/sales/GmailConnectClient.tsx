"use client";

import { useEffect, useState } from "react";

type Status = { connected: boolean; email: string | null; configured: boolean };

export default function GmailConnectClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/sales/gmail/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setStatus({ connected: Boolean(d.connected), email: d.email ?? null, configured: Boolean(d.configured) });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Gmail status"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    if (gmail === "connected") setMessage("Gmail connected.");
    if (gmail === "error") setError(params.get("message") || "Gmail connect failed.");
  }, []);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/gmail/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Disconnect failed");
      setMessage("Gmail disconnected.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const r = data.result;
      setMessage(
        r?.skippedReason
          ? r.skippedReason
          : `Reply sync done — ${r?.repliesRecorded ?? 0} new replies recorded.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function runNudges() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/gmail/nudges/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nudge run failed");
      const r = data.result;
      setMessage(`Nudge drafts — considered ${r?.considered ?? 0}, created ${r?.created ?? 0}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nudge run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Gmail (1:1 outreach)</h2>
          <p className="mt-1 text-xs text-gray-500">
            Approve in the queue sends from your inbox. Replies are detected automatically; nudges are drafted for your
            approval — never auto-sent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status?.connected ? (
            <>
              <button
                onClick={syncNow}
                disabled={busy}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-50"
              >
                Sync replies now
              </button>
              <button
                onClick={runNudges}
                disabled={busy}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-50"
              >
                Generate due nudges
              </button>
              <button
                onClick={disconnect}
                disabled={busy}
                className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <a
              href="/api/sales/gmail/connect"
              className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-900"
            >
              Connect Gmail
            </a>
          )}
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      ) : status?.connected ? (
        <p className="mt-3 text-sm text-emerald-400">Connected as {status.email}</p>
      ) : status?.configured ? (
        <p className="mt-3 text-sm text-amber-300">Not connected — approve will fall back to clipboard until you connect.</p>
      ) : (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          OAuth env not set. Add <span className="font-mono">GOOGLE_CLIENT_ID</span>,{" "}
          <span className="font-mono">GOOGLE_CLIENT_SECRET</span>, and{" "}
          <span className="font-mono">GMAIL_TOKEN_ENCRYPTION_KEY</span>, then run{" "}
          <span className="font-mono">supabase/sales-platform-add-gmail.sql</span>.
        </p>
      )}

      {message && <p className="mt-2 text-sm text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
