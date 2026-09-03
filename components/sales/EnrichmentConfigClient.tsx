"use client";

import { useEffect, useState } from "react";
import { SalesOverlay, SalesToolButton } from "@/components/sales/SalesOverlay";

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
  const [open, setOpen] = useState(false);
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

  const missing = Boolean(status?.missing.length);
  const tone = error || missing ? "warn" : status?.ready ? "ok" : "neutral";
  const buttonStatus = error
    ? "error"
    : missing
      ? "key missing"
      : credits?.ok && credits.creditsUsed != null && credits.creditsAvailable != null
        ? `${credits.creditsUsed}/${credits.creditsAvailable}`
        : status?.ready
          ? "ready"
          : "…";

  return (
    <>
      <SalesToolButton
        label="Hunter"
        status={buttonStatus}
        tone={tone}
        onClick={() => setOpen(true)}
      />
      <SalesOverlay open={open} title="Contact enrichment (Hunter)" onClose={() => setOpen(false)}>
        {error ? (
          <p className="text-sm text-red-300">Enrichment config check failed: {error}</p>
        ) : !status ? (
          <p className="text-sm text-gray-500">Checking Hunter enrichment…</p>
        ) : status.missing.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-100/90">{status.message}</p>
            <p className="text-xs text-amber-200/70">
              Add <code className="rounded bg-black/30 px-1">HUNTER_API_KEY</code> in Vercel Production and Cursor
              Cloud Agent secrets, then redeploy / start a new agent. Apollo is not used.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Hunter Email Finder finds addresses; Email Verifier (0.5 credit) checks they will not bounce before they
              reach the queue.
            </p>
            {credits?.ok ? (
              <p className="text-xs text-gray-500">
                Plan: {credits.planName ?? "—"}
                {credits.creditsUsed != null && credits.creditsAvailable != null
                  ? ` · Credits used ${credits.creditsUsed} / ${credits.creditsAvailable}`
                  : credits.searchesUsed != null && credits.searchesAvailable != null
                    ? ` · Searches used ${credits.searchesUsed} / ${credits.searchesAvailable}`
                    : ""}
                {credits.resetDate ? ` · Resets ${credits.resetDate}` : ""}
              </p>
            ) : credits?.error ? (
              <p className="text-xs text-amber-200/80">Could not load Hunter balance: {credits.error}</p>
            ) : null}
          </div>
        )}
      </SalesOverlay>
    </>
  );
}
