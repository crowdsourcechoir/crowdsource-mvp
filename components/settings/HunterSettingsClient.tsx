"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FieldLabel,
  InlineNote,
  SettingsButton,
  SettingsPanel,
  Stat,
  StatGrid,
  StatusPill,
  TextField,
} from "@/components/settings/ui";

type EnrichmentStatus = {
  provider?: string;
  hunter: boolean;
  ready: boolean;
  missing: string[];
  message: string | null;
};

type Credits = {
  ok: boolean;
  planName: string | null;
  resetDate: string | null;
  creditsUsed: number | null;
  creditsAvailable: number | null;
  searchesUsed: number | null;
  searchesAvailable: number | null;
  error: string | null;
};

type FindResult = {
  status: "found" | "not_found" | "error";
  email: string | null;
  error: string | null;
  creditDelta: number | null;
};

function formatResetDate(raw: string | null): { label: string; hint?: string } {
  if (!raw) return { label: "—" };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { label: raw };
  const label = parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const days = Math.ceil((parsed.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label, hint: "Reset date has passed — refresh balance" };
  return { label, hint: days === 0 ? "Renews today" : `Renews in ${days} day${days === 1 ? "" : "s"}` };
}

export default function HunterSettingsClient({
  verifyCapPerRun,
  costRules,
}: {
  verifyCapPerRun: number;
  costRules: { action: string; cost: string }[];
}) {
  const [status, setStatus] = useState<EnrichmentStatus | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");
  const [finding, setFinding] = useState(false);
  const [findResult, setFindResult] = useState<FindResult | null>(null);

  const loadCredits = useCallback(async (): Promise<Credits | null> => {
    const res = await fetch("/api/sales/enrichment/credits", { cache: "no-store" });
    const data = (await res.json()) as Credits & { error?: string };
    setCredits(data);
    return data;
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const statusRes = await fetch("/api/sales/enrichment/status", { cache: "no-store" });
      const statusData = (await statusRes.json()) as EnrichmentStatus & { error?: string };
      if (statusData.error) throw new Error(statusData.error);
      setStatus({
        hunter: Boolean(statusData.hunter),
        ready: Boolean(statusData.ready),
        missing: Array.isArray(statusData.missing) ? statusData.missing : [],
        message: statusData.message ?? null,
      });
      await loadCredits();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load Hunter status");
    } finally {
      setRefreshing(false);
    }
  }, [loadCredits]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runFind() {
    if (!firstName.trim() || !lastName.trim() || !domain.trim()) return;
    setFinding(true);
    setFindResult(null);
    const before = credits?.creditsUsed ?? null;
    try {
      const params = new URLSearchParams({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        domain: domain.trim(),
      });
      const res = await fetch(`/api/sales/enrichment/find?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const after = await loadCredits();
      const usedAfter = after?.creditsUsed ?? null;
      setFindResult({
        status: data.enrichment?.status ?? "error",
        email: data.enrichment?.email ?? null,
        error: data.enrichment?.error ?? null,
        creditDelta: before != null && usedAfter != null ? usedAfter - before : null,
      });
    } catch (err) {
      setFindResult({
        status: "error",
        email: null,
        error: err instanceof Error ? err.message : "Find failed",
        creditDelta: null,
      });
    } finally {
      setFinding(false);
    }
  }

  const keyMissing = Boolean(status?.missing.length);
  const reset = formatResetDate(credits?.resetDate ?? null);
  const remaining =
    credits?.creditsAvailable != null && credits?.creditsUsed != null
      ? credits.creditsAvailable - credits.creditsUsed
      : null;

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Provider"
        title="Hunter.io"
        description="Hunter is the only contact-enrichment provider. Without a key, named contacts stay awaiting contact and the approval queue stays empty."
        actions={
          <>
            <StatusPill tone={loadError ? "off" : keyMissing ? "warn" : status?.ready ? "ok" : "neutral"}>
              {loadError ? "Error" : keyMissing ? "Key missing" : status?.ready ? "Ready" : "Checking"}
            </StatusPill>
            <SettingsButton onClick={() => void load()} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </SettingsButton>
          </>
        }
      >
        {loadError ? <InlineNote tone="off">{loadError}</InlineNote> : null}
        {keyMissing ? (
          <InlineNote tone="warn">
            {status?.message ??
              "HUNTER_API_KEY is missing — contact enrichment is off."}{" "}
            Add <code className="text-xs text-gray-300">HUNTER_API_KEY</code> in Vercel Production and Cursor Cloud
            Agent secrets, then redeploy.
          </InlineNote>
        ) : null}
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Balance"
        title="Credits & renewal"
        description="Account balance checks are free. Numbers come straight from your Hunter account."
      >
        {credits?.error ? <InlineNote tone="warn">Could not load balance: {credits.error}</InlineNote> : null}
        <StatGrid>
          <Stat label="Plan" value={credits?.planName ?? "—"} />
          <Stat
            label="Credits used"
            value={
              credits?.creditsUsed != null && credits?.creditsAvailable != null
                ? `${credits.creditsUsed} / ${credits.creditsAvailable}`
                : "—"
            }
            hint={remaining != null ? `${remaining} remaining this period` : undefined}
          />
          <Stat
            label="Searches used"
            value={
              credits?.searchesUsed != null && credits?.searchesAvailable != null
                ? `${credits.searchesUsed} / ${credits.searchesAvailable}`
                : "—"
            }
          />
          <Stat label="Renews" value={reset.label} hint={reset.hint} />
        </StatGrid>
        <p className="text-xs text-gray-500">
          Plan pricing and billing live in your Hunter dashboard — this page reports usage against the plan.
        </p>
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Cost model"
        title="What spends credits"
        description="Fixed Hunter rules the pipeline is built around."
      >
        <div className="csc-list">
          {costRules.map((rule) => (
            <div key={rule.action} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-white">{rule.action}</span>
              <span className="text-sm text-gray-400">{rule.cost}</span>
            </div>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Behavior"
        title="Find & verify policy"
        description="How the pipeline spends Hunter credits during a run."
      >
        <StatGrid>
          <Stat label="Provider" value="Hunter only" hint="Apollo is not used" />
          <Stat label="Verify cap" value={`${verifyCapPerRun} checks / run`} hint="Protects against runaway spend" />
          <Stat label="Finder" value="Named contacts only" hint="Runs when a contact has a name and org domain" />
        </StatGrid>
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Test"
        title="One-shot email finder"
        description="Spends 1 credit only if an email is found. Credit delta is reported after the run."
        actions={
          <SettingsButton
            variant="primary"
            onClick={() => void runFind()}
            disabled={finding || keyMissing || !firstName.trim() || !lastName.trim() || !domain.trim()}
          >
            {finding ? "Finding…" : "Run finder"}
          </SettingsButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>First name</FieldLabel>
            <TextField value={firstName} onChange={setFirstName} placeholder="Jane" disabled={keyMissing} />
          </div>
          <div>
            <FieldLabel>Last name</FieldLabel>
            <TextField value={lastName} onChange={setLastName} placeholder="Doe" disabled={keyMissing} />
          </div>
          <div>
            <FieldLabel>Company domain</FieldLabel>
            <TextField value={domain} onChange={setDomain} placeholder="example.com" disabled={keyMissing} />
          </div>
        </div>

        {findResult ? (
          <div className="rounded-lg border border-white/10 p-4">
            {findResult.status === "found" ? (
              <InlineNote tone="ok">Found {findResult.email}</InlineNote>
            ) : findResult.status === "not_found" ? (
              <InlineNote>No email found — this attempt was free.</InlineNote>
            ) : (
              <InlineNote tone="off">{findResult.error ?? "Find failed"}</InlineNote>
            )}
            <p className="mt-2 text-xs text-gray-500">
              {findResult.creditDelta == null
                ? "Credit delta unavailable"
                : `Credits used delta: ${findResult.creditDelta >= 0 ? "+" : ""}${findResult.creditDelta}`}
            </p>
          </div>
        ) : null}
      </SettingsPanel>
    </div>
  );
}
