"use client";

import { useEffect, useState } from "react";
import type { DigestRun } from "@/lib/sales/types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DigestClient() {
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFailed, setShowFailed] = useState(false);

  function loadRuns() {
    setLoading(true);
    fetch("/api/sales/digest?limit=10", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRuns(Array.isArray(d.runs) ? d.runs : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRuns();
  }, []);

  async function sendNow() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/sales/digest/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Digest send failed");
      loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Digest send failed");
    } finally {
      setSending(false);
    }
  }

  const succeeded = runs.filter((r) => r.status === "succeeded");
  const failedCount = runs.filter((r) => r.status === "failed").length;
  const latest = runs[0];
  const noProviderConfigured = latest && latest.status === "skipped_no_provider";
  const visibleRuns = showFailed ? runs : succeeded;

  return (
    <div className="mb-6 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Morning digest</h2>
          <p className="mt-1 text-xs text-gray-500">
            Internal email of new 70+ queue leads (Resend). Test send uses whatever currently qualifies.
          </p>
        </div>
        <button
          onClick={sendNow}
          disabled={sending}
          className="shrink-0 rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send test digest"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {noProviderConfigured && (
        <p className="mt-3 text-xs text-gray-500">
          Digest provider not fully configured (Resend domain / from address). Outreach itself uses Gmail, not this list.
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Recent successful sends</h3>
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowFailed((v) => !v)}
              className="text-xs text-gray-500 underline"
            >
              {showFailed ? "Hide setup errors" : `${failedCount} setup error${failedCount === 1 ? "" : "s"} (hidden)`}
            </button>
          )}
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : visibleRuns.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            {failedCount > 0 && !showFailed ? "No successful digest yet." : "No digest sends yet."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {visibleRuns.map((run) => (
              <li key={run.id} className="rounded-lg border border-gray-900 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-gray-300">
                    {formatWhen(run.startedAt)} · <span className="text-gray-500">{run.trigger}</span>
                  </span>
                  <span className={run.status === "succeeded" ? "text-emerald-400" : "text-gray-500"}>
                    {run.status === "skipped_no_provider" ? "not configured" : run.status}
                  </span>
                </div>
                {run.status === "succeeded" && (
                  <p className="mt-1 text-xs text-gray-500">
                    {run.itemCount} new lead(s) · sent to {run.recipient}
                  </p>
                )}
                {showFailed && run.error && <p className="mt-1 text-xs text-gray-500">{run.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
