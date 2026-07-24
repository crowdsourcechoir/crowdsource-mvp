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

  const latest = runs[0];
  const noProviderConfigured = latest && latest.status === "skipped_no_provider";

  return (
    <div className="mb-6 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Morning digest email</h2>
          <p className="mt-1 text-xs text-gray-500">
            Cron emails new review-queue leads scoring 70+ once at least 10 are ready (tunable via{" "}
            <span className="font-mono">SALES_DIGEST_MIN_SCORE</span> /{" "}
            <span className="font-mono">SALES_DIGEST_TARGET_COUNT</span>), topping up the pipeline until then. Test send
            below bypasses the count wait and sends whatever currently qualifies.
          </p>
        </div>
        <button
          onClick={sendNow}
          disabled={sending}
          className="shrink-0 rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send test digest now"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {noProviderConfigured && (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          No email provider configured — this was a no-op. Add <span className="font-mono">RESEND_API_KEY</span> and{" "}
          <span className="font-mono">SALES_DIGEST_TO_EMAIL</span> to activate the digest.
        </p>
      )}

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Recent sends</h3>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No digest sends yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg border border-gray-900 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-gray-300">
                    {formatWhen(run.startedAt)} · <span className="text-gray-500">{run.trigger}</span>
                  </span>
                  <span
                    className={
                      run.status === "succeeded"
                        ? "text-emerald-400"
                        : run.status === "failed"
                          ? "text-red-400"
                          : run.status === "skipped_no_provider"
                            ? "text-gray-500"
                            : run.status === "deferred"
                              ? "text-amber-400"
                              : "text-sky-400"
                    }
                  >
                    {run.status === "skipped_no_provider"
                      ? "no provider configured"
                      : run.status === "deferred"
                        ? "deferred — still under target"
                        : run.status}
                  </span>
                </div>
                {run.status === "succeeded" && (
                  <p className="mt-1 text-xs text-gray-500">
                    {run.itemCount} new lead(s) · sent to {run.recipient}
                  </p>
                )}
                {run.status === "deferred" && (
                  <p className="mt-1 text-xs text-gray-500">
                    {run.itemCount} qualifying so far · waiting for target before send
                  </p>
                )}
                {run.error && <p className="mt-1 text-xs text-red-400">{run.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
