"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Candidate = { organizationId: string; organizationName?: string; score: number };

export default function FillQueueClient() {
  const [solidCount, setSolidCount] = useState<number | null>(null);
  const [nearMissCount, setNearMissCount] = useState<number | null>(null);
  const [minScore, setMinScore] = useState(70);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [limit, setLimit] = useState(10);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/pipeline/fill-queue", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load blocked leads");
      setSolidCount(data.solidCount ?? 0);
      setNearMissCount(data.nearMissCount ?? 0);
      setMinScore(data.minScore ?? 70);
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load blocked leads");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fill() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/sales/pipeline/fill-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fill queue failed");
      const s = data.summary;
      setResult(
        `Reprocessed ${s.attempted} of ${s.considered} blocked lead(s). Check the ` +
          `approval queue — newly verified contacts land there.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fill queue failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">Fill the queue</h2>
          <p className="mt-1 text-xs text-gray-400">
            Re-runs pipeline on high-scoring leads stuck at <span className="text-gray-300">awaiting contact</span>{" "}
            (score ≥{minScore}). Enrichment retries + leadership deepen can clear the verified-email gate without
            lowering quality.
          </p>
          <p className="mt-2 text-sm text-gray-300">
            {solidCount === null ? (
              "Checking blocked leads…"
            ) : (
              <>
                <span className="font-semibold text-white">{solidCount}</span> solid (≥{minScore}) blocked
                {nearMissCount ? (
                  <>
                    {" "}
                    · <span className="text-amber-300">{nearMissCount}</span> near-miss also eligible
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500">
            Limit
            <input
              type="number"
              min={1}
              max={25}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(25, Number(e.target.value) || 10)))}
              disabled={running}
              className="ml-2 w-16 rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-white disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            onClick={fill}
            disabled={running || solidCount === 0}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {running ? "Filling…" : "Fill queue now"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {result && (
        <p className="mt-3 text-sm text-emerald-300">
          {result}{" "}
          <Link href="/admin/sales/queue" className="underline">
            Open queue →
          </Link>
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-500">
          {candidates.slice(0, 12).map((c) => (
            <li key={c.organizationId} className="flex justify-between gap-2 border-b border-gray-900 py-1">
              <Link href={`/admin/sales/organizations/${c.organizationId}`} className="truncate text-gray-400 hover:underline">
                {c.organizationName ?? c.organizationId.slice(0, 8)}
              </Link>
              <span className={c.score >= minScore ? "text-emerald-400" : "text-amber-400"}>
                score {c.score.toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
