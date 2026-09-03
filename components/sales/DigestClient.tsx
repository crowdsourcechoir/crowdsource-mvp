"use client";

import { useEffect, useState } from "react";
import type { DigestRun } from "@/lib/sales/types";
import { SalesOverlay, SalesToolButton } from "@/components/sales/SalesOverlay";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DigestClient() {
  const [open, setOpen] = useState(false);
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
  const buttonStatus = loading
    ? "…"
    : succeeded.length > 0
      ? `${succeeded.length} sent`
      : noProviderConfigured
        ? "setup"
        : "idle";

  return (
    <>
      <SalesToolButton
        label="Daily digest"
        status={buttonStatus}
        tone={noProviderConfigured ? "warn" : succeeded.length > 0 ? "ok" : "neutral"}
        onClick={() => setOpen(true)}
      />
      <SalesOverlay open={open} title="Morning digest" onClose={() => setOpen(false)}>
        <p className="mb-4 text-xs text-gray-500">
          Internal email of new 70+ queue leads (Resend). Test send uses whatever currently qualifies.
        </p>

        <button
          onClick={sendNow}
          disabled={sending}
          className="mb-4 rounded-lg bg-[#CFFF81] px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send test digest"}
        </button>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {noProviderConfigured && (
          <p className="mb-3 text-xs text-gray-500">
            Digest provider not fully configured (Resend domain / from address). Outreach itself uses Gmail, not this
            list.
          </p>
        )}

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Recent successful sends</h3>
            {failedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowFailed((v) => !v)}
                className="text-xs text-gray-500 underline"
              >
                {showFailed
                  ? "Hide setup errors"
                  : `${failedCount} setup error${failedCount === 1 ? "" : "s"} (hidden)`}
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
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
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
      </SalesOverlay>
    </>
  );
}
