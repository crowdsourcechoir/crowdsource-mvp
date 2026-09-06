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
  ToggleRow,
} from "@/components/settings/ui";

type DigestSettings = {
  enabled: boolean;
  minScore: number;
  targetCount: number;
  recipient: string | null;
  fromEmail: string;
  providerConfigured: boolean;
  transport: "resend" | "gmail" | "none";
  transportReason: string | null;
  effectiveRecipient: string | null;
  gmailEmail: string | null;
  resendConfigured: boolean;
  envDefaults: { minScore: number; targetCount: number; recipient: string | null };
  overrides: { enabled: boolean | null; minScore: number | null; targetCount: number | null; recipient: string | null };
  persisted: boolean;
  storeError: string | null;
  cronSchedules: string[];
};

type DigestRun = {
  id: string;
  trigger: string;
  status: string;
  itemCount: number;
  recipient: string | null;
  error: string | null;
  startedAt: string;
};

function formatWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DigestSettingsClient() {
  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [minScore, setMinScore] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applySettings = useCallback((data: DigestSettings) => {
    setSettings(data);
    setMinScore(String(data.minScore));
    setTargetCount(String(data.targetCount));
    setRecipient(data.recipient ?? "");
  }, []);

  const load = useCallback(async () => {
    try {
      const [settingsRes, runsRes] = await Promise.all([
        fetch("/api/sales/digest/settings", { cache: "no-store" }),
        fetch("/api/sales/digest?limit=10", { cache: "no-store" }),
      ]);
      const settingsData = await settingsRes.json();
      if (settingsData.error) throw new Error(settingsData.error);
      applySettings(settingsData as DigestSettings);
      const runsData = await runsRes.json();
      setRuns(Array.isArray(runsData.runs) ? runsData.runs : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load digest settings");
    }
  }, [applySettings]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>, note: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/digest/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      applySettings(data as DigestSettings);
      setMessage(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function sendNow(force: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/sales/digest/run${force ? "?force=1" : ""}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Digest run failed");
      const r = data.result ?? {};
      setMessage(
        r.status === "succeeded"
          ? `Digest sent with ${r.itemCount ?? 0} leads.`
          : r.status === "deferred"
            ? r.error ?? "Deferred — still below target."
            : r.status === "skipped_disabled"
              ? "Digest is turned off."
              : r.status === "skipped_no_provider"
                ? r.error ?? "No mailer configured — connect Gmail or set a verified Resend sender."
                : r.status === "skipped_empty"
                  ? "Nothing qualifies right now."
                  : r.error ?? `Run finished: ${r.status ?? "unknown"}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Digest run failed");
    } finally {
      setBusy(false);
    }
  }

  const thresholdsDirty =
    settings != null &&
    (minScore !== String(settings.minScore) ||
      targetCount !== String(settings.targetCount) ||
      recipient !== (settings.recipient ?? ""));

  const tone = !settings ? "neutral" : !settings.enabled ? "off" : settings.providerConfigured ? "ok" : "warn";
  const label = !settings ? "Checking" : !settings.enabled ? "Off" : settings.providerConfigured ? "On" : "Not configured";

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Delivery"
        title="Morning digest"
        description="An internal email of high-confidence leads. Prospects never receive this."
        actions={
          <>
            <StatusPill tone={tone}>{label}</StatusPill>
            <SettingsButton onClick={() => void sendNow(false)} disabled={busy || !settings?.enabled}>
              Send now
            </SettingsButton>
            <SettingsButton
              variant="primary"
              onClick={() => void sendNow(true)}
              disabled={busy || !settings?.enabled}
              title="Send everything currently qualifying, ignoring the target wait"
            >
              Force send
            </SettingsButton>
          </>
        }
      >
        <ToggleRow
          label="Daily digest enabled"
          hint="Off stops cron and manual sends without touching Resend config."
          checked={Boolean(settings?.enabled)}
          disabled={busy || !settings}
          onChange={(next) => void patch({ enabled: next }, next ? "Digest turned on." : "Digest turned off.")}
        />
        {settings && settings.transport === "gmail" ? (
          <InlineNote>
            Delivered from your connected Gmail ({settings.gmailEmail}) to itself. Resend needs a verified domain, so it
            is not used.
          </InlineNote>
        ) : null}
        {settings && settings.transport === "none" ? (
          <InlineNote tone="warn">{settings.transportReason ?? "No mailer configured — sends will be skipped."}</InlineNote>
        ) : null}
        {settings && !settings.persisted ? (
          <InlineNote tone="warn">
            {settings.storeError ?? "Settings storage is unavailable — changes will not persist."}
          </InlineNote>
        ) : null}
        {message ? <InlineNote tone="ok">{message}</InlineNote> : null}
        {error ? <InlineNote tone="off">{error}</InlineNote> : null}
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Thresholds"
        title="When it sends and to whom"
        description="The digest waits until enough leads clear the score bar, then emails once."
        actions={
          <SettingsButton
            variant="primary"
            disabled={busy || !thresholdsDirty}
            onClick={() =>
              void patch(
                {
                  minScore: minScore === "" ? null : Number(minScore),
                  targetCount: targetCount === "" ? null : Number(targetCount),
                  recipient,
                },
                "Digest thresholds saved."
              )
            }
          >
            {busy ? "Saving…" : "Save"}
          </SettingsButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel hint={`Env default ${settings?.envDefaults.minScore ?? "—"}`}>Minimum score</FieldLabel>
            <TextField type="number" value={minScore} onChange={setMinScore} disabled={busy} />
          </div>
          <div>
            <FieldLabel hint={`Env default ${settings?.envDefaults.targetCount ?? "—"}`}>Target lead count</FieldLabel>
            <TextField type="number" value={targetCount} onChange={setTargetCount} disabled={busy} />
          </div>
          <div>
            <FieldLabel hint={settings?.envDefaults.recipient ? `Env default ${settings.envDefaults.recipient}` : "No env default"}>
              Recipient
            </FieldLabel>
            <TextField type="email" value={recipient} onChange={setRecipient} placeholder="you@example.com" disabled={busy} />
          </div>
        </div>
        <StatGrid>
          <Stat
            label="From"
            value={(settings?.transport === "gmail" ? settings.gmailEmail : settings?.fromEmail) ?? "—"}
            hint={settings?.transport === "gmail" ? "Connected Gmail" : "SALES_DIGEST_FROM_EMAIL"}
          />
          <Stat
            label="Schedule"
            value={settings?.cronSchedules.length ? `${settings.cronSchedules.length} cron ticks` : "—"}
            hint="Vercel cron, UTC"
          />
          <Stat
            label="Sent via"
            value={settings?.transport === "gmail" ? "Gmail" : settings?.transport === "resend" ? "Resend" : "Not configured"}
            hint={settings?.effectiveRecipient ?? undefined}
          />
        </StatGrid>
      </SettingsPanel>

      <SettingsPanel eyebrow="History" title="Recent runs" description="Latest digest attempts, newest first.">
        {runs.length === 0 ? (
          <InlineNote>No digest runs recorded yet.</InlineNote>
        ) : (
          <div className="csc-list">
            {runs.map((run) => (
              <div key={run.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-white">
                    {formatWhen(run.startedAt)} · {run.trigger}
                  </p>
                  {run.error ? <p className="mt-0.5 truncate text-xs text-red-300">{run.error}</p> : null}
                </div>
                <p className="text-sm text-gray-400">
                  {run.status} · {run.itemCount} leads{run.recipient ? ` · ${run.recipient}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}
