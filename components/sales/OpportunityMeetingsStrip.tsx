"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SyncedCalendarEvent } from "@/lib/sales/calendar/types";

function formatMeeting(event: SyncedCalendarEvent): string {
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return event.summary;
  if (event.allDay) {
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${event.summary}`;
  }
  return `${start.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} · ${event.summary}`;
}

function eventEndMs(event: SyncedCalendarEvent): number {
  return event.endAt ? Date.parse(event.endAt) : Date.parse(event.startAt);
}

function mergeUnique(lists: SyncedCalendarEvent[][]): SyncedCalendarEvent[] {
  const byId = new Map<string, SyncedCalendarEvent>();
  for (const list of lists) {
    for (const event of list) {
      if (!byId.has(event.googleEventId)) byId.set(event.googleEventId, event);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/**
 * Meetings for an opportunity (and optional primary contact), past + upcoming.
 * Past meetings matter for “who have I already met with?” — not only future holds.
 */
export default function OpportunityMeetingsStrip({
  opportunityId,
  contactId,
}: {
  opportunityId: string;
  contactId?: string | null;
}) {
  const [events, setEvents] = useState<SyncedCalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const urls = [
      `/api/sales/calendar/events?opportunityId=${encodeURIComponent(opportunityId)}`,
    ];
    if (contactId) {
      urls.push(`/api/sales/calendar/events?contactId=${encodeURIComponent(contactId)}`);
    }

    Promise.all(
      urls.map((url) =>
        fetch(url, { cache: "no-store" })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return [] as SyncedCalendarEvent[];
            return Array.isArray(data.events) ? (data.events as SyncedCalendarEvent[]) : [];
          })
          .catch(() => [] as SyncedCalendarEvent[])
      )
    )
      .then((lists) => {
        if (cancelled) return;
        const now = Date.now();
        const merged = mergeUnique(lists).filter((e) => e.status !== "cancelled");
        const upcoming = merged
          .filter((e) => eventEndMs(e) >= now - 60 * 60 * 1000)
          .slice(0, 4);
        const past = merged
          .filter((e) => eventEndMs(e) < now - 60 * 60 * 1000)
          .reverse()
          .slice(0, 4)
          .reverse();
        setEvents([...past, ...upcoming]);
      })
      .catch(() => {
        /* non-fatal */
      });

    return () => {
      cancelled = true;
    };
  }, [opportunityId, contactId]);

  if (events.length === 0) return null;

  const now = Date.now();
  const past = events.filter((e) => eventEndMs(e) < now - 60 * 60 * 1000);
  const upcoming = events.filter((e) => eventEndMs(e) >= now - 60 * 60 * 1000);

  return (
    <div className="rounded-xl border border-[var(--csc-row-divider)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="csc-eyebrow">Meetings</p>
        <Link
          href="/admin/sales/calendar?filter=matched"
          className="csc-link text-[11px] font-semibold uppercase tracking-[0.14em]"
        >
          Calendar →
        </Link>
      </div>
      {past.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Past</p>
          <ul className="mt-1.5 space-y-1.5">
            {past.map((event) => (
              <li key={event.googleEventId} className="text-sm text-gray-300">
                {event.htmlLink ? (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white hover:underline"
                  >
                    {formatMeeting(event)}
                  </a>
                ) : (
                  formatMeeting(event)
                )}
                {event.contactName ? (
                  <span className="ml-2 text-xs text-gray-500">with {event.contactName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {upcoming.length > 0 ? (
        <div className={past.length > 0 ? "mt-3" : "mt-2"}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Upcoming</p>
          <ul className="mt-1.5 space-y-1.5">
            {upcoming.map((event) => (
              <li key={event.googleEventId} className="text-sm text-gray-300">
                {event.htmlLink ? (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white hover:underline"
                  >
                    {formatMeeting(event)}
                  </a>
                ) : (
                  formatMeeting(event)
                )}
                {event.contactName ? (
                  <span className="ml-2 text-xs text-gray-500">with {event.contactName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
