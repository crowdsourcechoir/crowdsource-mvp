import type { calendar_v3 } from "googleapis";
import type { Event } from "@/data/mockEvents";
import { siteUrl } from "@/lib/site-url";
import { getCalendarClient } from "@/lib/sales/calendar/client";
import {
  BLOOM_CALENDAR_PROP,
  CALENDAR_PRIMARY_ID,
  hasCalendarWriteScope,
} from "@/lib/sales/calendar/constants";
import { upsertCalendarStoreEvent, removeCalendarStoreEvent } from "@/lib/sales/calendar/store";
import type { SyncedCalendarEvent } from "@/lib/sales/calendar/types";
import { toDateInputValue, toTimeInputValue } from "@/lib/event-datetime-input";
import {
  clearBloomGoogleEventId,
  readBloomCalendarIds,
  setBloomGoogleEventId,
} from "./bloom-calendar-ids";

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
/** Blooms are Seattle-local for v1 scheduling. */
const BLOOM_TZ = "America/Los_Angeles";

export type BloomCalendarFields = Pick<
  Event,
  "id" | "slug" | "title" | "description" | "date" | "time" | "venue" | "address"
>;

export function bloomCalendarRelevantBody(body: Record<string, unknown>): boolean {
  return (
    body.title !== undefined ||
    body.date !== undefined ||
    body.time !== undefined ||
    body.venue !== undefined ||
    body.address !== undefined ||
    body.description !== undefined ||
    body.slug !== undefined
  );
}

function locationLine(bloom: BloomCalendarFields): string | null {
  const parts = [bloom.venue?.trim(), bloom.address?.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function buildStartEnd(bloom: BloomCalendarFields): {
  start: calendar_v3.Schema$EventDateTime;
  end: calendar_v3.Schema$EventDateTime;
  allDay: boolean;
  startAt: string;
  endAt: string;
} | null {
  const date = toDateInputValue(bloom.date ?? "");
  if (!date) return null;
  const time = toTimeInputValue(bloom.time ?? "");
  if (!time) {
    // All-day: Google end date is exclusive.
    const endDate = new Date(`${date}T12:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endYmd = endDate.toISOString().slice(0, 10);
    return {
      start: { date },
      end: { date: endYmd },
      allDay: true,
      startAt: new Date(`${date}T00:00:00.000Z`).toISOString(),
      endAt: new Date(`${endYmd}T00:00:00.000Z`).toISOString(),
    };
  }
  const startLocal = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startLocal.getTime())) return null;
  // Interpret as Pacific wall clock via Intl offset approximation:
  // Use explicit offset from a formatter in BLOOM_TZ.
  const startAt = zonedLocalToUtcIso(date, time, BLOOM_TZ);
  if (!startAt) return null;
  const endAt = new Date(Date.parse(startAt) + DEFAULT_DURATION_MS).toISOString();
  return {
    start: { dateTime: startAt, timeZone: BLOOM_TZ },
    end: { dateTime: endAt, timeZone: BLOOM_TZ },
    allDay: false,
    startAt,
    endAt,
  };
}

/** Convert YYYY-MM-DD + HH:MM in a named zone to UTC ISO. */
function zonedLocalToUtcIso(date: string, time: string, timeZone: string): string | null {
  try {
    const probe = new Date(`${date}T${time}:00Z`);
    if (Number.isNaN(probe.getTime())) return null;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    // Binary-search offset: compare intended local parts to UTC instant.
    // Simpler approach: use temporal-less offset from formatter on a UTC guess.
    let guess = Date.parse(`${date}T${time}:00.000Z`);
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(
        fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value])
      ) as Record<string, string>;
      const asUtc = Date.parse(
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`
      );
      const intended = Date.parse(`${date}T${time}:00.000Z`);
      guess += intended - asUtc;
    }
    return new Date(guess).toISOString();
  } catch {
    return null;
  }
}

function bloomDescription(bloom: BloomCalendarFields): string {
  const base = siteUrl();
  const publicUrl = bloom.slug ? `${base}/e/${encodeURIComponent(bloom.slug)}` : base;
  const adminUrl = `${base}/admin/events/${encodeURIComponent(bloom.id)}`;
  const bits = [
    bloom.description?.trim() || null,
    `Bloom: ${publicUrl}`,
    `Admin: ${adminUrl}`,
  ].filter(Boolean);
  return bits.join("\n\n");
}

function toSyncedEvent(
  bloom: BloomCalendarFields,
  googleEventId: string,
  htmlLink: string | null,
  timing: NonNullable<ReturnType<typeof buildStartEnd>>,
  organizerEmail: string | null
): SyncedCalendarEvent {
  return {
    googleEventId,
    calendarId: CALENDAR_PRIMARY_ID,
    status: "confirmed",
    summary: bloom.title?.trim() || "Bloom",
    description: bloomDescription(bloom),
    location: locationLine(bloom),
    htmlLink,
    hangoutLink: null,
    startAt: timing.startAt,
    endAt: timing.endAt,
    allDay: timing.allDay,
    organizerEmail,
    attendeeEmails: organizerEmail ? [organizerEmail] : [],
    contactId: null,
    contactName: null,
    contactEmail: null,
    organizationId: null,
    organizationName: null,
    opportunityId: null,
    matchStatus: "self_only",
    syncedAt: new Date().toISOString(),
    source: "bloom",
    bloomId: bloom.id,
    bloomSlug: bloom.slug || null,
  };
}

async function findGoogleEventId(
  calendar: calendar_v3.Calendar,
  bloomId: string
): Promise<string | null> {
  const map = await readBloomCalendarIds();
  if (map[bloomId]) return map[bloomId];
  try {
    const res = await calendar.events.list({
      calendarId: CALENDAR_PRIMARY_ID,
      privateExtendedProperty: [`${BLOOM_CALENDAR_PROP}=${bloomId}`],
      maxResults: 5,
      singleEvents: true,
    });
    const id = res.data.items?.[0]?.id ?? null;
    if (id) await setBloomGoogleEventId(bloomId, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Create or update the Google Calendar event for a Bloom, and mirror it into the
 * Sales calendar store so the Calendar page shows it with a Bloom badge.
 */
export async function upsertBloomGoogleCalendarEvent(
  bloom: BloomCalendarFields
): Promise<{ ok: true; googleEventId: string } | { ok: false; error: string }> {
  if (!bloom.id?.trim()) return { ok: false, error: "Bloom id is required." };
  const timing = buildStartEnd(bloom);
  if (!timing) return { ok: false, error: "Bloom needs a date before it can sync to Calendar." };

  const bundle = await getCalendarClient();
  if (!bundle) return { ok: false, error: "Google account is not connected." };
  if (!hasCalendarWriteScope(bundle.scopes)) {
    return {
      ok: false,
      error:
        "Reconnect Google in Settings → Google connections and allow Calendar (write) so Blooms can sync.",
    };
  }

  const body: calendar_v3.Schema$Event = {
    summary: bloom.title?.trim() || "Bloom",
    description: bloomDescription(bloom),
    location: locationLine(bloom) ?? undefined,
    start: timing.start,
    end: timing.end,
    extendedProperties: {
      private: { [BLOOM_CALENDAR_PROP]: bloom.id },
    },
  };

  try {
    const existingId = await findGoogleEventId(bundle.calendar, bloom.id);
    let googleEventId: string;
    let htmlLink: string | null = null;
    if (existingId) {
      const patched = await bundle.calendar.events.patch({
        calendarId: CALENDAR_PRIMARY_ID,
        eventId: existingId,
        requestBody: body,
      });
      googleEventId = patched.data.id ?? existingId;
      htmlLink = patched.data.htmlLink ?? null;
    } else {
      const inserted = await bundle.calendar.events.insert({
        calendarId: CALENDAR_PRIMARY_ID,
        requestBody: body,
      });
      if (!inserted.data.id) return { ok: false, error: "Google did not return an event id." };
      googleEventId = inserted.data.id;
      htmlLink = inserted.data.htmlLink ?? null;
      await setBloomGoogleEventId(bloom.id, googleEventId);
    }

    await upsertCalendarStoreEvent(
      toSyncedEvent(bloom, googleEventId, htmlLink, timing, bundle.email)
    );
    return { ok: true, googleEventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bloom calendar sync failed";
    console.warn("[bloom-calendar] upsert failed:", message);
    return { ok: false, error: message };
  }
}

export async function deleteBloomGoogleCalendarEvent(
  bloomId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!bloomId.trim()) return { ok: false, error: "Bloom id is required." };
  const bundle = await getCalendarClient();
  if (!bundle) {
    await clearBloomGoogleEventId(bloomId);
    await removeCalendarStoreEventByBloomId(bloomId);
    return { ok: true };
  }
  if (!hasCalendarWriteScope(bundle.scopes)) {
    await clearBloomGoogleEventId(bloomId);
    await removeCalendarStoreEventByBloomId(bloomId);
    return {
      ok: false,
      error: "Calendar write not granted — cleared local Bloom calendar link only.",
    };
  }

  try {
    const existingId = await findGoogleEventId(bundle.calendar, bloomId);
    if (existingId) {
      await bundle.calendar.events.delete({
        calendarId: CALENDAR_PRIMARY_ID,
        eventId: existingId,
      });
      await removeCalendarStoreEvent(existingId);
    } else {
      await removeCalendarStoreEventByBloomId(bloomId);
    }
    await clearBloomGoogleEventId(bloomId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bloom calendar delete failed";
    console.warn("[bloom-calendar] delete failed:", message);
    await clearBloomGoogleEventId(bloomId);
    await removeCalendarStoreEventByBloomId(bloomId);
    return { ok: false, error: message };
  }
}

async function removeCalendarStoreEventByBloomId(bloomId: string): Promise<void> {
  const { readCalendarStore, writeCalendarStore } = await import("@/lib/sales/calendar/store");
  const { store } = await readCalendarStore();
  const next = store.events.filter((e) => e.bloomId !== bloomId);
  if (next.length === store.events.length) return;
  await writeCalendarStore({ ...store, events: next });
}
