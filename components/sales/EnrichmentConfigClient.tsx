"use client";

import { useEffect, useState } from "react";

type Status = {
  hunter: boolean;
  apollo: boolean;
  ready: boolean;
  missing: string[];
  message: string | null;
};

export default function EnrichmentConfigClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sales/enrichment/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setStatus({
          hunter: Boolean(d.hunter),
          apollo: Boolean(d.apollo),
          ready: Boolean(d.ready),
          missing: Array.isArray(d.missing) ? d.missing : [],
          message: d.message ?? null,
        });
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
        Checking enrichment API keys…
      </div>
    );
  }

  if (status.missing.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-gray-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contact enrichment</h2>
        <p className="mt-1 text-sm text-gray-300">
          Hunter and Apollo keys are set. Finders use Hunter first, then Apollo on error.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-800/70 bg-amber-950/25 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/90">
        Contact enrichment — key{status.missing.length > 1 ? "s" : ""} missing
      </h2>
      <p className="mt-2 text-sm text-amber-100/90">{status.message}</p>
      <ul className="mt-3 list-inside list-disc text-sm text-amber-100/80">
        {status.missing.map((name) => (
          <li key={name}>
            <code className="rounded bg-black/30 px-1 py-0.5 text-amber-50">{name}</code>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-amber-200/70">
        Add both in Vercel → Project Settings → Environment Variables (Production), and in Cursor → Cloud
        Agents → this environment → Secrets, then redeploy / start a new agent.
      </p>
    </div>
  );
}
