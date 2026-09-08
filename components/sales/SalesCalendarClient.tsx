"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsButton, StatusPill } from "@/components/settings/ui";
import type { SyncedCalendarEvent } from "@/lib/sales/calendar/types";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayLabel(key: string): string {
  const parsed = new Date(`${key}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return key;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(event: SyncedCalendarEvent): string {
  if (event.allDay) return "All day";
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return "—";
  return start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isToday(key: string): boolean {
  return key === new Date().toISOString().slice(0, 10);
}

export default function SalesCalendarClient() {
  const [events, setEvents] = useState<SyncedCalendarEvent[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "matched" | "all">("upcoming");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/calendar/events", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load calendar");
      setEvents(Array.isArray(data.events) ? data.events : []);
      setLastSyncedAt(data.lastSyncedAt ?? null);
      setError(data.lastSyncError ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sales/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.result?.error || data.error || "Sync failed");
      const r = data.result ?? {};
      setMessage(`Synced ${r.synced ?? 0} meetings · ${r.matched ?? 0} matched`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = events.filter((e) => e.status !== "cancelled");
    if (filter === "matched") list = list.filter((e) => e.matchStatus === "matched");
    if (filter === "upcoming") {
      list = list.filter((e) => {
        const end = e.endAt ? Date.parse(e.endAt) : Date.parse(e.startAt);
        return end >= now - 60 * 60 * 1000;
      });
    }
    return list;
  }, [events, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, SyncedCalendarEvent[]>();
    for (const event of filtered) {
      const key = dayKey(event.startAt);
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="w-full space-y-6 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="csc-eyebrow">Prospecting Intelligence</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Calendar</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Meetings from your Google Calendar, matched to Sales contacts when an attendee email is known.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SettingsButton onClick={() => void syncNow()} disabled={busy}>
            {busy ? "Syncing…" : "Sync now"}
          </SettingsButton>
          <Link href="/admin/settings/gmail" className="csc-link text-xs font-semibold uppercase tracking-[0.14em]">
            Google settings →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["upcoming", "Upcoming"],
            ["matched", "Matched"],
            ["all", "All synced"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              filter === id
                ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
                : "border-white/20 text-gray-300 hover:border-white/40 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-gray-500">
          {lastSyncedAt ? `Last sync ${new Date(lastSyncedAt).toLocaleString()}` : "Not synced yet"}
        </span>
      </div>

      {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {error ? <p className="text-sm text-amber-200">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading meetings…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-[var(--csc-row-divider)] p-6">
          <p className="text-sm text-gray-300">No meetings in this view yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            Connect Google Calendar in Settings, allow Calendar access, then Sync. Meetings with known contact emails
            show as matched.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, dayEvents]) => (
            <section key={day}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">{formatDayLabel(day)}</h2>
                {isToday(day) ? <StatusPill tone="ok">Today</StatusPill> : null}
              </div>
              <div className="csc-list">
                {dayEvents.map((event) => (
                  <div
                    key={event.googleEventId}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">{formatTime(event)}</p>
                      <p className="mt-1 text-sm font-medium text-white">{event.summary}</p>
                      {event.location ? (
                        <p className="mt-1 truncate text-xs text-gray-500">{event.location}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {event.matchStatus === "matched" ? (
                          <StatusPill tone="ok">Matched</StatusPill>
                        ) : event.matchStatus === "self_only" ? (
                          <StatusPill tone="neutral">Just you</StatusPill>
                        ) : (
                          <StatusPill tone="warn">Unmatched</StatusPill>
                        )}
                        {event.contactName ? (
                          <span className="text-xs text-gray-300">
                            {event.contactName}
                            {event.organizationName ? ` · ${event.organizationName}` : ""}
                          </span>
                        ) : event.contactEmail ? (
                          <span className="text-xs text-gray-500">{event.contactEmail}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {event.opportunityId ? (
                        <Link
                          href={`/admin/sales/opportunities/${event.opportunityId}`}
                          className="csc-link text-xs font-semibold uppercase tracking-[0.14em]"
                        >
                          Opportunity →
                        </Link>
                      ) : null}
                      {event.organizationId ? (
                        <Link
                          href={`/admin/sales/organizations/${event.organizationId}`}
                          className="csc-link text-xs font-semibold uppercase tracking-[0.14em]"
                        >
                          Org →
                        </Link>
                      ) : null}
                      {event.htmlLink ? (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="csc-link text-xs font-semibold uppercase tracking-[0.14em]"
                        >
                          Google →
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
