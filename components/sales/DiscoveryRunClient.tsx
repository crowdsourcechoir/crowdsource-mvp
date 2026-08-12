"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DiscoveryRun } from "@/lib/sales/types";
import {
  DISCOVERY_MODE_OPTIONS,
  MAJOR_CONVENTION_CITIES,
  type DiscoveryMode,
} from "@/lib/sales/discovery/presets";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const DEFAULT_CITIES = ["Nashville", "Chicago", "Orlando", "Las Vegas", "Denver", "Seattle", "Atlanta", "Dallas"];

export default function DiscoveryRunClient() {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DiscoveryMode>("convention_centers");
  const [cities, setCities] = useState<string[]>(DEFAULT_CITIES);
  const [focus, setFocus] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [maxNew, setMaxNew] = useState(15);

  const modeMeta = useMemo(() => DISCOVERY_MODE_OPTIONS.find((m) => m.id === mode), [mode]);

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

  function toggleCity(city: string) {
    setCities((prev) => (prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]));
  }

  async function startDiscovery() {
    setError(null);
    if (mode === "convention_centers" && cities.length === 0) {
      setError("Pick at least one city for convention-center discovery.");
      return;
    }
    if (mode === "custom" && !focus.trim()) {
      setError("Add a custom focus (e.g. “state municipal league annual conferences”).");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/sales/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          cities: mode === "default" ? undefined : cities,
          focus: focus.trim() || undefined,
          year,
          maxNewOrganizations: maxNew,
          maxQueries: mode === "convention_centers" ? 10 : 6,
        }),
      });
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Discover new organizations</h2>
          <p className="mt-1 text-xs text-gray-500">
            Stage 0 — searches for new candidate organizations not yet in your list. Nightly cron still uses the default
            org-type rotation; use parameters here to hunt higher-signal lists (convention centers, custom focus). New rows
            show up below with source <span className="text-gray-400">ai_discovered</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={startDiscovery}
          disabled={running}
          className="shrink-0 rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
        >
          {running ? "Running…" : "Run discovery now"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-gray-400">
          Focus mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as DiscoveryMode)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-white"
          >
            {DISCOVERY_MODE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-400">
          Event year
          <input
            type="number"
            value={year}
            min={2025}
            max={2035}
            onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear() + 1)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-gray-400">
          Max new orgs
          <input
            type="number"
            value={maxNew}
            min={1}
            max={50}
            onChange={(e) => setMaxNew(Math.min(50, Math.max(1, Number(e.target.value) || 15)))}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-gray-400 sm:col-span-2 lg:col-span-1">
          Extra focus (optional)
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder={mode === "custom" ? "Required — e.g. municipal league conferences" : "e.g. higher education"}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-white placeholder:text-gray-600"
          />
        </label>
      </div>
      {modeMeta && <p className="mt-2 text-xs text-gray-500">{modeMeta.description}</p>}

      {mode !== "default" && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-400">Cities</p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="text-sky-400 underline"
                onClick={() => setCities([...MAJOR_CONVENTION_CITIES])}
              >
                All major
              </button>
              <button type="button" className="text-sky-400 underline" onClick={() => setCities([...DEFAULT_CITIES])}>
                Reset core 8
              </button>
              <button type="button" className="text-sky-400 underline" onClick={() => setCities([])}>
                Clear
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MAJOR_CONVENTION_CITIES.map((city) => {
              const on = cities.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  className={`rounded-full border px-2.5 py-1 text-xs touch-manipulation ${
                    on
                      ? "border-emerald-600 bg-emerald-950/40 text-emerald-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
                {run.queries[0]?.query && (
                  <p className="mt-1 truncate text-xs text-gray-600" title={run.queries.map((q) => q.query).join(" · ")}>
                    e.g. {run.queries[0].query}
                  </p>
                )}
                {run.error && <p className="mt-1 text-xs text-red-400">{run.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Tip: “found” ≠ approval queue. Discovery only adds organizations (see{" "}
        <span className="text-emerald-500">new</span> count). Convention-center mode extracts the{" "}
        <span className="text-gray-400">hosting association</span>, not the venue. Then run the pipeline on those orgs —
        they only reach the{" "}
        <Link href="/admin/sales/queue" className="underline">
          queue
        </Link>{" "}
        after research + a verified contact email.
      </p>
    </div>
  );
}
