"use client";

import { useEffect, useState } from "react";

type Status = {
  hunter: boolean;
  ready: boolean;
  missing: string[];
  message: string | null;
};

type Credits = {
  ok: boolean;
  planName: string | null;
  creditsUsed: number | null;
  creditsAvailable: number | null;
  searchesUsed: number | null;
  searchesAvailable: number | null;
  resetDate: string | null;
  error: string | null;
};

export default function EnrichmentConfigClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/sales/enrichment/status", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/sales/enrichment/credits", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([d, c]) => {
        if (d.error) throw new Error(d.error);
        setStatus({
          hunter: Boolean(d.hunter),
          ready: Boolean(d.ready),
          missing: Array.isArray(d.missing) ? d.missing : [],
          message: d.message ?? null,
        });
        if (!c.error || c.ok === false || c.ok === true) {
          setCredits({
            ok: Boolean(c.ok),
            planName: c.planName ?? null,
            creditsUsed: c.creditsUsed ?? null,
            creditsAvailable: c.creditsAvailable ?? null,
            searchesUsed: c.searchesUsed ?? null,
            searchesAvailable: c.searchesAvailable ?? null,
            resetDate: c.resetDate ?? null,
            error: c.error ?? null,
          });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load enrichment status"));
  }, []);

  if (error) {
    return (
      <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
        Enrichment config check failed: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="mb-6 rounded-xl border border-gray-800 p-4 text-xs text-gray-500">
        Checking Hunter enrichment…
      </div>
    );
  }

  if (status.missing.length > 0) {
    return (
      <div className="mb-6 rounded-xl border border-amber-800/70 bg-amber-950/25 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/90">
          Contact enrichment — Hunter key missing
        </h2>
        <p className="mt-2 text-sm text-amber-100/90">{status.message}</p>
        <p className="mt-3 text-xs text-amber-200/70">
          Add <code className="rounded bg-black/30 px-1">HUNTER_API_KEY</code> in Vercel Production and Cursor Cloud
          Agent secrets, then redeploy / start a new agent. Apollo is not used.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-800 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contact enrichment (Hunter only)</h2>
      <p className="mt-1 text-sm text-gray-300">
        Hunter Email Finder is the sole enrichment provider for this sales agent.
      </p>
      {credits?.ok ? (
        <p className="mt-2 text-xs text-gray-500">
          Plan: {credits.planName ?? "—"}
          {credits.creditsUsed != null && credits.creditsAvailable != null
            ? ` · Credits used ${credits.creditsUsed} / ${credits.creditsAvailable}`
            : credits.searchesUsed != null && credits.searchesAvailable != null
              ? ` · Searches used ${credits.searchesUsed} / ${credits.searchesAvailable}`
              : ""}
          {credits.resetDate ? ` · Resets ${credits.resetDate}` : ""}
        </p>
      ) : credits?.error ? (
        <p className="mt-2 text-xs text-amber-200/80">Could not load Hunter balance: {credits.error}</p>
      ) : null}
    </div>
  );
}
