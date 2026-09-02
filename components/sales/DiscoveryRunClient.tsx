"use client";

import { useEffect, useState } from "react";
import type { DiscoveryRun } from "@/lib/sales/types";
import { SEARCH_DISABLED_REASON } from "@/lib/sales/discovery/search";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** History only — Tavily discovery is off. */
export default function DiscoveryRunClient() {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sales/discovery?limit=10", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRuns(Array.isArray(d.runs) ? d.runs : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mb-6 rounded-xl border border-gray-800 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Organization discovery</h2>
      <p className="mt-2 text-sm text-amber-200/90">{SEARCH_DISABLED_REASON}</p>
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Past runs</h3>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No discovery runs.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg border border-gray-900 px-3 py-2 text-gray-400">
                {formatWhen(run.startedAt)} · {run.trigger}
                {run.provider ? ` · ${run.provider}` : ""} · {run.status}
                {run.error ? <span className="mt-1 block text-xs text-red-400">{run.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
