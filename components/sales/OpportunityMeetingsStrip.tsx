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

/** Compact meetings strip for opportunity / contact surfaces. */
export default function OpportunityMeetingsStrip({ opportunityId }: { opportunityId: string }) {
  const [events, setEvents] = useState<SyncedCalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sales/calendar/events?opportunityId=${encodeURIComponent(opportunityId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const list = Array.isArray(data.events) ? (data.events as SyncedCalendarEvent[]) : [];
        const now = Date.now();
        const upcoming = list
          .filter((e) => {
            const end = e.endAt ? Date.parse(e.endAt) : Date.parse(e.startAt);
            return end >= now - 60 * 60 * 1000;
          })
          .slice(0, 3);
        setEvents(upcoming);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--csc-row-divider)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="csc-eyebrow">Meetings</p>
        <Link href="/admin/sales/calendar" className="csc-link text-[11px] font-semibold uppercase tracking-[0.14em]">
          Calendar →
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {events.map((event) => (
          <li key={event.googleEventId} className="text-sm text-gray-300">
            {event.htmlLink ? (
              <a href={event.htmlLink} target="_blank" rel="noreferrer" className="hover:text-white hover:underline">
                {formatMeeting(event)}
              </a>
            ) : (
              formatMeeting(event)
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
