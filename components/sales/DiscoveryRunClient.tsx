"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DiscoveryRun } from "@/lib/sales/types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DiscoveryRunClient() {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadRuns() {
    setLoading(true);
    fetch("/api/sales/discovery?limit=10", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRuns(Array.isArray(d.runs) ? d.runs : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRuns();
  }, []);

  async function startDiscovery() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch("/api/sales/discovery/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery run failed");
      loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery run failed");
    } finally {
      setRunning(false);
    }
  }

  const latest = runs[0];
  const noProviderConfigured = latest && latest.provider === null;

  return (
    <div className="mb-6 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Discover new organizations</h2>
          <p className="mt-1 text-xs text-gray-500">
            Stage 0 — searches for new candidate organizations not yet in your list, runs nightly via cron. New rows show up
            below and in{" "}
            <Link href="/admin/sales/organizations" className="underline">
              Organizations
            </Link>{" "}
            with a source of <span className="text-gray-400">ai_discovered</span>, ready for the pipeline like any other org.
          </p>
        </div>
        <button
          onClick={startDiscovery}
          disabled={running}
          className="shrink-0 rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
        >
          {running ? "Running…" : "Run discovery now"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {noProviderConfigured && (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          No search provider configured — this was a no-op (zero cost, zero organizations created). Add{" "}
          <span className="font-mono">TAVILY_API_KEY</span> (or <span className="font-mono">SERPER_API_KEY</span> as a
          fallback) to <span className="font-mono">.env.local</span> to activate discovery.
        </p>
      )}

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Recent runs</h3>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No discovery runs yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg border border-gray-900 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-gray-300">
                    {formatWhen(run.startedAt)} · <span className="text-gray-500">{run.trigger}</span>
                    {run.provider && <span className="text-gray-500"> · {run.provider}</span>}
                  </span>
                  <span
                    className={
                      run.status === "succeeded"
                        ? "text-emerald-400"
                        : run.status === "failed"
                          ? "text-red-400"
                          : "text-sky-400"
                    }
                  >
                    {run.status}
                  </span>
                </div>
                {run.provider ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {run.queries.length} quer{run.queries.length === 1 ? "y" : "ies"} · {run.candidatesFound} candidate(s)
                    found · <span className="text-emerald-500">{run.candidatesNew} new</span> ·{" "}
                    {run.candidatesDuplicate} already known
                    {run.costUsd ? ` · ~$${run.costUsd.toFixed(3)}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">No search provider configured — no-op.</p>
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
