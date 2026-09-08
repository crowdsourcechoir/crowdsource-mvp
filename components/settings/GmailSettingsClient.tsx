"use client";

import Link from "next/link";
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

type CalendarStatus = {
  connected: boolean;
  email: string | null;
  configured: boolean;
  calendarGranted: boolean;
  requiredScope: string;
  grantedScopes: string[];
  window: { pastDays: number; nextDays: number };
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  eventCount: number;
  matchedCount: number;
  unmatchedCount: number;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gmailRes, calendarRes] = await Promise.all([
        fetch("/api/sales/gmail/status", { cache: "no-store" }),
        fetch("/api/sales/calendar/status", { cache: "no-store" }),
      ]);
      const gmailData = (await gmailRes.json().catch(() => ({}))) as GmailStatus & { error?: string };
      if (typeof gmailData.configured === "boolean") {
        setStatus({
          connected: Boolean(gmailData.connected),
          email: gmailData.email ?? null,
          configured: Boolean(gmailData.configured),
          sendsEnabled: Boolean(gmailData.sendsEnabled),
        });
      }
      const calendarData = (await calendarRes.json().catch(() => ({}))) as CalendarStatus & { error?: string };
      if (!calendarRes.ok && calendarData.error) {
        // Non-fatal — Gmail panel can still work.
        setCalendar(null);
      } else if (typeof calendarData.calendarGranted === "boolean") {
        setCalendar(calendarData);
      }
      if (!gmailRes.ok || gmailData.error) {
        throw new Error(
          typeof gmailData.error === "string" && gmailData.error.trim()
            ? gmailData.error
            : `Google status failed (${gmailRes.status}). OAuth may still work — try Connect.`
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Google status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      setMessage(
        "Google connected. Sending stays paused until you resume it. If Calendar was just granted, click Sync calendar now."
      );
    }
    if (params.get("gmail") === "error") {
      setError(params.get("message") || "Google connect failed.");
    }
  }, [load]);

  async function post(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const result = data.result as { error?: string } | undefined;
      throw new Error((result?.error as string) || (data.error as string) || "Request failed");
    }
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
          : "Sending paused. Google stays connected; nothing goes out until you resume."
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
          : `Inbox scan done — ${r.repliesRecorded ?? 0} replies, ${r.outboundsRecorded ?? 0} sent by you, ${r.autoRepliesRecorded ?? 0} auto-replies, ${r.bouncesRecorded ?? 0} bounces.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncCalendarNow() {
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/sales/calendar/sync");
      const r = (data.result ?? {}) as Record<string, number | string>;
      setMessage(
        `Calendar sync — ${r.synced ?? 0} meetings (${r.matched ?? 0} matched to contacts, ${r.unmatched ?? 0} unmatched).`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar sync failed");
      await load();
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
    if (!window.confirm("Disconnect Google? Gmail sending and Calendar sync stop until you reconnect.")) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/sales/gmail/disconnect");
      setMessage("Google disconnected.");
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

  const calendarTone = !status?.connected
    ? "neutral"
    : calendar?.calendarGranted
      ? "ok"
      : "warn";
  const calendarLabel = !status?.connected
    ? "Needs Google"
    : calendar?.calendarGranted
      ? "Calendar on"
      : "Reconnect needed";

  const displayedScopes = calendar?.grantedScopes?.length ? calendar.grantedScopes : scopes;

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Connection"
        title="Google account"
        description="One Google connection powers Gmail outreach and Calendar meeting sync for Sales."
        actions={
          <>
            <StatusPill tone={tone}>{label}</StatusPill>
            {status?.connected ? (
              <SettingsButton variant="danger" onClick={() => void disconnect()} disabled={busy}>
                Disconnect
              </SettingsButton>
            ) : (
              <SettingsButton variant="primary" href="/api/sales/gmail/connect?returnTo=/admin/settings/gmail">
                Connect Google
              </SettingsButton>
            )}
          </>
        }
      >
        <StatGrid>
          <Stat label="Account" value={status?.email ?? "Not connected"} />
          <Stat
            label="OAuth config"
            value={status?.configured ? "Configured" : "Missing"}
            hint={
              status?.configured
                ? undefined
                : "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_TOKEN_ENCRYPTION_KEY"
            }
          />
          <Stat label="Sending" value={status?.sendsEnabled ? "Resumed" : "Paused"} />
        </StatGrid>
        {message ? <InlineNote tone="ok">{message}</InlineNote> : null}
        {error ? <InlineNote tone="off">{error}</InlineNote> : null}
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Calendar"
        title="Meeting sync"
        description="Pulls primary-calendar meetings into Sales so you can see conversations with contacts on a calendar."
        actions={
          <>
            <StatusPill tone={calendarTone}>{calendarLabel}</StatusPill>
            {status?.connected && !calendar?.calendarGranted ? (
              <SettingsButton variant="primary" href="/api/sales/gmail/connect?returnTo=/admin/settings/gmail">
                Reconnect for Calendar
              </SettingsButton>
            ) : (
              <SettingsButton
                onClick={() => void syncCalendarNow()}
                disabled={busy || !status?.connected || !calendar?.calendarGranted}
              >
                Sync calendar now
              </SettingsButton>
            )}
            <Link href="/admin/sales/calendar" className="csc-link text-xs font-semibold uppercase tracking-[0.14em]">
              Open calendar →
            </Link>
          </>
        }
      >
        <StatGrid>
          <Stat
            label="Access"
            value={calendar?.calendarGranted ? "calendar.readonly" : "Not granted"}
            hint={calendar?.calendarGranted ? undefined : "Reconnect and allow Google Calendar"}
          />
          <Stat
            label="Window"
            value={
              calendar
                ? `Past ${calendar.window.pastDays}d · next ${calendar.window.nextDays}d`
                : "Past 7d · next 30d"
            }
          />
          <Stat label="Last sync" value={formatWhen(calendar?.lastSyncedAt ?? null)} />
          <Stat
            label="Meetings"
            value={calendar ? String(calendar.eventCount) : "—"}
            hint={
              calendar
                ? `${calendar.matchedCount} matched · ${calendar.unmatchedCount} unmatched`
                : undefined
            }
          />
        </StatGrid>
        {calendar?.lastSyncError ? <InlineNote tone="warn">{calendar.lastSyncError}</InlineNote> : null}
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Safety"
        title="Sending"
        description="Reconnecting never resumes sending on its own, and every email still needs a per-send confirmation."
      >
        <ToggleRow
          label="Sending enabled"
          hint="Off means Google stays connected but nothing can leave the app."
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
          {displayedScopes.map((scope) => (
            <div key={scope} className="py-3">
              <code className="text-xs text-gray-300">{scope}</code>
            </div>
          ))}
        </div>
      </SettingsPanel>
    </div>
  );
}
