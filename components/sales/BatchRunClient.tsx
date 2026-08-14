"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Organization } from "@/lib/sales/types";

type RunState = "pending" | "running" | "succeeded" | "failed" | "skipped_existing_client";

type RunRow = { organization: Organization; state: RunState; detail?: string };

export default function BatchRunClient() {
  const [count, setCount] = useState(10);
  const [rows, setRows] = useState<RunRow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRequested = useRef(false);

  async function startBatch() {
    setError(null);
    setRunning(true);
    stopRequested.current = false;
    try {
      const res = await fetch(`/api/sales/organizations/unprocessed?limit=${count}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load unprocessed organizations");
      const organizations: Organization[] = data.organizations ?? [];
      setRows(organizations.map((organization) => ({ organization, state: "pending" as RunState })));

      for (let i = 0; i < organizations.length; i++) {
        if (stopRequested.current) break;
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, state: "running" } : r)));
        try {
          const runRes = await fetch("/api/sales/pipeline/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: organizations[i].id }),
          });
          const runData = await runRes.json();
          if (!runRes.ok) throw new Error(runData.error ?? "Pipeline run failed");
          const status = runData.summary.status as RunState;
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, state: status, detail: `${runData.summary.opportunityIds.length} opportunity(ies)` } : r
            )
          );
        } catch (err) {
          setRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, state: "failed", detail: err instanceof Error ? err.message : "Failed" } : r))
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch run failed");
    } finally {
      setRunning(false);
    }
  }

  const doneCount = rows.filter((r) => r.state !== "pending" && r.state !== "running").length;
  const succeededCount = rows.filter((r) => r.state === "succeeded").length;

  return (
    <div className="mb-6 rounded-xl border border-gray-800 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Run pipeline on next</h2>
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
          disabled={running}
          className="w-20 rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white disabled:opacity-50"
        />
        <span className="text-sm text-gray-400">unprocessed organizations (Priority A interleaved with AI-discovered)</span>
        {!running ? (
          <button onClick={startBatch} className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-900">
            Start batch
          </button>
        ) : (
          <button
            onClick={() => (stopRequested.current = true)}
            className="rounded-lg border border-red-700 px-4 py-1.5 text-sm font-medium text-red-400 hover:bg-red-950/40"
          >
            Stop after current
          </button>
        )}
        {rows.length > 0 && (
          <span className="text-sm text-gray-500">
            {doneCount}/{rows.length} done, {succeededCount} succeeded
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Each organization takes roughly a minute (research + scoring + drafting). Keep this tab open — this runs in your
          browser session, not a background job.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {rows.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
          {rows.map((r) => (
            <li key={r.organization.id} className="flex items-center justify-between gap-2 border-b border-gray-900 py-1">
              <span className="truncate text-gray-300">{r.organization.name}</span>
              <span
                className={
                  r.state === "succeeded"
                    ? "text-emerald-400"
                    : r.state === "failed"
                      ? "text-red-400"
                      : r.state === "running"
                        ? "text-sky-400"
                        : r.state === "skipped_existing_client"
                          ? "text-gray-500"
                          : "text-gray-600"
                }
              >
                {r.state === "skipped_existing_client" ? "existing client" : r.state}
                {r.detail ? ` · ${r.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {doneCount > 0 && doneCount === rows.length && (
        <p className="mt-3 text-sm text-gray-300">
          Batch complete.{" "}
          <Link href="/admin/sales/queue" className="underline">
            Go review the approval queue →
          </Link>
        </p>
      )}
    </div>
  );
}
