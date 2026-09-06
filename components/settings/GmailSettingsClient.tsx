"use client";

import { useCallback, useEffect, useState } from "react";
import {
  InlineNote,
  SettingsButton,
  SettingsPanel,
  Stat,
  StatGrid,
  StatusPill,
  ToggleRow,
} from "@/components/settings/ui";

type GmailStatus = {
  connected: boolean;
  email: string | null;
  configured: boolean;
  sendsEnabled: boolean;
  error?: string | null;
};

export default function GmailSettingsClient({
  scopes,
  nudgeDueAfterDays,
  maxNudgesPerOpportunity,
}: {
  scopes: string[];
  nudgeDueAfterDays: number;
  maxNudgesPerOpportunity: number;
}) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/gmail/status", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as GmailStatus & { error?: string };
      if (typeof data.configured === "boolean") {
        setStatus({
          connected: Boolean(data.connected),
          email: data.email ?? null,
          configured: Boolean(data.configured),
          sendsEnabled: Boolean(data.sendsEnabled),
        });
      }
      if (!res.ok || data.error) {
        throw new Error(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `Gmail status failed (${res.status}). OAuth may still work — try Connect Gmail.`
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Gmail status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      setMessage("Gmail connected. Sending stays paused until you resume it below.");
    }
    if (params.get("gmail") === "error") {
      setError(params.get("message") || "Gmail connect failed.");
    }
  }, [load]);

  async function post(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error((data.error as string) ?? "Request failed");
    return data;
  }

  async function setSendsEnabled(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const data = (await post("/api/sales/gmail/sends", { enabled })) as unknown as GmailStatus;
      setStatus({
        connected: Boolean(data.connected),
        email: data.email ?? null,
        configured: Boolean(data.configured),
        sendsEnabled: Boolean(data.sendsEnabled),
      });
      setMessage(
        enabled
          ? "Sending resumed. Each email still needs Send → Yes, send now."
          : "Sending paused. Gmail stays connected; nothing goes out until you resume."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update sending");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/sales/gmail/sync");
      const r = (data.result ?? {}) as Record<string, number | string | null>;
      setMessage(
        r.skippedReason
          ? String(r.skippedReason)
          : `Inbox scan done — ${r.repliesRecorded ?? 0} replies, ${r.autoRepliesRecorded ?? 0} auto-replies, ${r.bouncesRecorded ?? 0} bounces.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function runNudges() {
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/sales/gmail/nudges/run");
      const r = (data.result ?? {}) as Record<string, number>;
      setMessage(`Nudge drafts — considered ${r.considered ?? 0}, created ${r.created ?? 0}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nudge run failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Gmail? Nothing will send from the app until you reconnect.")) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/sales/gmail/disconnect");
      setMessage("Gmail disconnected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  const tone = !status?.configured ? "warn" : status.connected ? (status.sendsEnabled ? "ok" : "warn") : "warn";
  const label = loading
    ? "Checking"
    : !status?.configured
      ? "OAuth missing"
      : status.connected
        ? status.sendsEnabled
          ? "Sending on"
          : "Paused"
        : "Not connected";

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Connection"
        title="Google account"
        description="Approved outreach sends from your own inbox. Replies sync back into the pipeline."
        actions={
          <>
            <StatusPill tone={tone}>{label}</StatusPill>
            {status?.connected ? (
              <SettingsButton variant="danger" onClick={() => void disconnect()} disabled={busy}>
                Disconnect
              </SettingsButton>
            ) : (
              <a
                href="/api/sales/gmail/connect?returnTo=/admin/settings/gmail"
                className="rounded-lg border border-[var(--csc-accent)] px-3 py-1.5 text-xs font-medium text-[var(--csc-accent)] transition-colors hover:bg-[var(--csc-accent)] hover:text-black"
              >
                Connect Gmail
              </a>
            )}
          </>
        }
      >
        <StatGrid>
          <Stat label="Account" value={status?.email ?? "Not connected"} />
          <Stat
            label="OAuth config"
            value={status?.configured ? "Configured" : "Missing"}
            hint={status?.configured ? undefined : "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_TOKEN_ENCRYPTION_KEY"}
          />
          <Stat label="Sending" value={status?.sendsEnabled ? "Resumed" : "Paused"} />
        </StatGrid>
        {message ? <InlineNote tone="ok">{message}</InlineNote> : null}
        {error ? <InlineNote tone="off">{error}</InlineNote> : null}
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Safety"
        title="Sending"
        description="Reconnecting never resumes sending on its own, and every email still needs a per-send confirmation."
      >
        <ToggleRow
          label="Sending enabled"
          hint="Off means Gmail stays connected but nothing can leave the app."
          checked={Boolean(status?.sendsEnabled)}
          disabled={busy || !status?.connected}
          onChange={(next) => void setSendsEnabled(next)}
        />
        <ul className="space-y-1 text-xs text-gray-500">
          <li>The same contact cannot be emailed twice from duplicate initial drafts.</li>
          <li>
            <code className="text-gray-400">SALES_GMAIL_SENDS_ENABLED=false</code> in Vercel overrides this toggle as an
            emergency stop.
          </li>
        </ul>
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Inbox"
        title="Reply sync & nudges"
        description="Sync runs on a schedule; use these when you want it now."
        actions={
          <>
            <SettingsButton onClick={() => void syncNow()} disabled={busy || !status?.connected}>
              Sync replies now
            </SettingsButton>
            <SettingsButton onClick={() => void runNudges()} disabled={busy || !status?.connected}>
              Generate due nudges
            </SettingsButton>
          </>
        }
      >
        <StatGrid>
          <Stat label="Nudge due after" value={`${nudgeDueAfterDays} days`} hint="No reply since last outbound" />
          <Stat label="Max nudges" value={`${maxNudgesPerOpportunity} per opportunity`} />
          <Stat label="Auto-send" value="Never" hint="Nudges are drafts until you approve them" />
        </StatGrid>
      </SettingsPanel>

      <SettingsPanel eyebrow="Access" title="Granted scopes">
        <div className="csc-list">
          {scopes.map((scope) => (
            <div key={scope} className="py-3">
              <code className="text-xs text-gray-300">{scope}</code>
            </div>
          ))}
        </div>
      </SettingsPanel>
    </div>
  );
}
