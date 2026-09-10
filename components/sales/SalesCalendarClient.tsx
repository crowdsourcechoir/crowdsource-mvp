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

function formatTimeRange(event: SyncedCalendarEvent): string {
  if (event.allDay) return "All day";
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return "—";
  const startLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!event.endAt) return startLabel;
  const end = new Date(event.endAt);
  if (Number.isNaN(end.getTime())) return startLabel;
  const endLabel = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${startLabel} – ${endLabel}`;
}

function isToday(key: string): boolean {
  return key === new Date().toISOString().slice(0, 10);
}

function MatchPill({ event }: { event: SyncedCalendarEvent }) {
  if (event.matchStatus === "matched") return <StatusPill tone="ok">Matched</StatusPill>;
  if (event.matchStatus === "self_only") return <StatusPill tone="neutral">Just you</StatusPill>;
  return <StatusPill tone="warn">Unmatched</StatusPill>;
}

function matchHint(event: SyncedCalendarEvent): string {
  if (event.matchStatus === "matched") {
    const who = event.contactName || event.contactEmail || "a Sales contact";
    const org = event.organizationName ? ` at ${event.organizationName}` : "";
    return `Matched to ${who}${org} by attendee email.`;
  }
  if (event.matchStatus === "self_only") {
    return "No other invitees on this meeting — or only your Google account.";
  }
  const email = event.contactEmail || event.attendeeEmails[0];
  return email
    ? `${email} is invited, but that address is not in Sales contacts yet.`
    : "Invitees are present, but none match a Sales contact email.";
}

export default function SalesCalendarClient() {
  const [events, setEvents] = useState<SyncedCalendarEvent[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [filter, setFilter] = useState<"matched" | "upcoming" | "all">("matched");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const fromQuery = params.get("filter");
    if (fromQuery === "matched" || fromQuery === "upcoming" || fromQuery === "all") {
      setFilter(fromQuery);
    }
  }, []);

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

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div className="flex w-full flex-col text-white" style={{ minHeight: "calc(100vh - 6rem)" }}>
      <div className="shrink-0 space-y-6 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="csc-eyebrow">Prospecting Intelligence</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Meetings from your Google Calendar, matched to Sales contacts by invitee email (past 90
              days · next 30).{" "}
              <span className="text-gray-300">Matched</span> is the default — past and upcoming
              meetings with people already in CRM.{" "}
              <span className="text-gray-300">Unmatched</span> means an invitee email is on the
              meeting but not yet in Sales contacts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SettingsButton onClick={() => void syncNow()} disabled={busy}>
              {busy ? "Syncing…" : "Sync now"}
            </SettingsButton>
            <Link
              href="/admin/settings/gmail"
              className="csc-link text-xs font-semibold uppercase tracking-[0.14em]"
            >
              Google settings →
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["matched", "With contacts"],
              ["upcoming", "Upcoming"],
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
            {filtered.length > 0 ? ` · ${filtered.length} shown` : ""}
          </span>
        </div>

        {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
        {error ? <p className="text-sm text-amber-200">{error}</p> : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading meetings…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-[var(--csc-row-divider)] p-6">
          <p className="text-sm text-gray-300">No meetings in this view yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            Connect Google Calendar in Settings, allow Calendar access, then Sync. Meetings with
            known contact emails show as matched.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-8">
          <ul className="csc-list">
            {grouped.flatMap(([day, dayEvents]) => {
              const dayHeader = (
                <li key={`day-${day}`} className="list-none px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="csc-eyebrow text-gray-400">{formatDayLabel(day)}</p>
                    {isToday(day) ? <StatusPill tone="ok">Today</StatusPill> : null}
                  </div>
                </li>
              );

              const rows = dayEvents.map((event) => {
                const open = expandedId === event.googleEventId;
                const meetingUrl = event.hangoutLink || null;
                const invitees = event.attendeeEmails.length
                  ? event.attendeeEmails
                  : event.organizerEmail
                    ? [event.organizerEmail]
                    : [];

                return (
                  <li key={event.googleEventId} className="list-none">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => toggleExpanded(event.googleEventId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpanded(event.googleEventId);
                        }
                      }}
                      className="csc-list-row"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{formatTime(event)}</p>
                        <p className="mt-1 text-sm font-medium text-white">{event.summary}</p>
                        {event.location ? (
                          <p className="mt-1 truncate text-xs text-gray-500">{event.location}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <MatchPill event={event} />
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
                      <span
                        aria-hidden
                        className={`shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 transition-transform ${
                          open ? "rotate-90 text-[var(--csc-accent)]" : ""
                        }`}
                      >
                        ›
                      </span>
                    </div>

                    {open ? (
                      <div
                        className="space-y-4 px-4 pb-5 pt-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs text-gray-500">{matchHint(event)}</p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="csc-eyebrow text-gray-500">When</p>
                            <p className="mt-1 text-gray-200">{formatTimeRange(event)}</p>
                          </div>
                          {event.location ? (
                            <div>
                              <p className="csc-eyebrow text-gray-500">Where</p>
                              <p className="mt-1 text-gray-200">{event.location}</p>
                            </div>
                          ) : null}
                          {event.organizerEmail ? (
                            <div>
                              <p className="csc-eyebrow text-gray-500">Organizer</p>
                              <p className="mt-1 text-gray-200">{event.organizerEmail}</p>
                            </div>
                          ) : null}
                          <div>
                            <p className="csc-eyebrow text-gray-500">Meeting link</p>
                            {meetingUrl ? (
                              <a
                                href={meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="csc-link mt-1 inline-block break-all text-sm"
                              >
                                {meetingUrl}
                              </a>
                            ) : (
                              <p className="mt-1 text-gray-500">No Meet / Zoom link on this event</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="csc-eyebrow text-gray-500">Invited</p>
                          {invitees.length === 0 ? (
                            <p className="mt-1 text-gray-500">No invitee emails synced</p>
                          ) : (
                            <ul className="mt-2 space-y-1">
                              {invitees.map((email) => {
                                const isMatch =
                                  event.matchStatus === "matched" &&
                                  event.contactEmail &&
                                  email.toLowerCase() === event.contactEmail.toLowerCase();
                                return (
                                  <li
                                    key={email}
                                    className="flex flex-wrap items-center gap-2 text-gray-200"
                                  >
                                    <span>{email}</span>
                                    {isMatch ? <StatusPill tone="ok">In Sales</StatusPill> : null}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>

                        {event.description ? (
                          <div>
                            <p className="csc-eyebrow text-gray-500">Notes</p>
                            <p className="mt-1 whitespace-pre-wrap text-gray-300">{event.description}</p>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-3 pt-1">
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
                              Open in Google →
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              });

              return [dayHeader, ...rows];
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
