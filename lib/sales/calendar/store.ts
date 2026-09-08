import { supabaseAdmin } from "@/lib/supabase-server";
import {
  CALENDAR_SYNC_NEXT_DAYS,
  CALENDAR_SYNC_PAST_DAYS,
} from "./constants";
import type { CalendarSyncStore, SyncedCalendarEvent } from "./types";

/**
 * Meeting store — JSON object in Supabase Storage (same pattern as workspace settings).
 * Good for a single operator's past-7 / next-30 day window without a schema migration.
 */

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "google-calendar/events-v1.json";
const CACHE_TTL_MS = 10_000;

export const EMPTY_CALENDAR_STORE: CalendarSyncStore = {
  lastSyncedAt: null,
  lastSyncError: null,
  window: { pastDays: CALENDAR_SYNC_PAST_DAYS, nextDays: CALENDAR_SYNC_NEXT_DAYS },
  events: [],
};

let cache: { value: CalendarSyncStore; expiresAt: number } | null = null;

function normalizeEvent(raw: unknown): SyncedCalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.googleEventId !== "string" || typeof row.startAt !== "string") return null;
  return {
    googleEventId: row.googleEventId,
    calendarId: typeof row.calendarId === "string" ? row.calendarId : "primary",
    status: typeof row.status === "string" ? row.status : "confirmed",
    summary: typeof row.summary === "string" ? row.summary : "(No title)",
    description: typeof row.description === "string" ? row.description : null,
    location: typeof row.location === "string" ? row.location : null,
    htmlLink: typeof row.htmlLink === "string" ? row.htmlLink : null,
    hangoutLink: typeof row.hangoutLink === "string" ? row.hangoutLink : null,
    startAt: row.startAt,
    endAt: typeof row.endAt === "string" ? row.endAt : null,
    allDay: Boolean(row.allDay),
    organizerEmail: typeof row.organizerEmail === "string" ? row.organizerEmail : null,
    attendeeEmails: Array.isArray(row.attendeeEmails)
      ? row.attendeeEmails.filter((e): e is string => typeof e === "string")
      : [],
    contactId: typeof row.contactId === "string" ? row.contactId : null,
    contactName: typeof row.contactName === "string" ? row.contactName : null,
    contactEmail: typeof row.contactEmail === "string" ? row.contactEmail : null,
    organizationId: typeof row.organizationId === "string" ? row.organizationId : null,
    organizationName: typeof row.organizationName === "string" ? row.organizationName : null,
    opportunityId: typeof row.opportunityId === "string" ? row.opportunityId : null,
    matchStatus:
      row.matchStatus === "matched" || row.matchStatus === "self_only" || row.matchStatus === "unmatched"
        ? row.matchStatus
        : "unmatched",
    syncedAt: typeof row.syncedAt === "string" ? row.syncedAt : new Date().toISOString(),
  };
}

export function normalizeCalendarStore(raw: unknown): CalendarSyncStore {
  const source = (raw ?? {}) as Record<string, unknown>;
  const window = (source.window ?? {}) as Record<string, unknown>;
  const events = Array.isArray(source.events)
    ? source.events.map(normalizeEvent).filter((e): e is SyncedCalendarEvent => Boolean(e))
    : [];
  return {
    lastSyncedAt: typeof source.lastSyncedAt === "string" ? source.lastSyncedAt : null,
    lastSyncError: typeof source.lastSyncError === "string" ? source.lastSyncError : null,
    window: {
      pastDays: typeof window.pastDays === "number" ? window.pastDays : CALENDAR_SYNC_PAST_DAYS,
      nextDays: typeof window.nextDays === "number" ? window.nextDays : CALENDAR_SYNC_NEXT_DAYS,
    },
    events,
  };
}

export function invalidateCalendarStoreCache(): void {
  cache = null;
}

async function fetchStore(): Promise<{ store: CalendarSyncStore; error: string | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { store: EMPTY_CALENDAR_STORE, error: "Supabase is not configured." };
  }

  const url = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${OBJECT_PATH}?ts=${Date.now()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Cache-Control": "no-cache",
    },
  });

  if (res.status === 404 || res.status === 400) {
    return { store: EMPTY_CALENDAR_STORE, error: null };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return {
      store: EMPTY_CALENDAR_STORE,
      error: `Calendar store read failed (${res.status})${detail ? `: ${detail}` : ""}`,
    };
  }

  const text = await res.text();
  if (!text.trim()) return { store: EMPTY_CALENDAR_STORE, error: null };
  return { store: normalizeCalendarStore(JSON.parse(text)), error: null };
}

export async function readCalendarStore(options?: { skipCache?: boolean }): Promise<{
  store: CalendarSyncStore;
  error: string | null;
}> {
  if (!options?.skipCache && cache && cache.expiresAt > Date.now()) {
    return { store: cache.value, error: null };
  }
  const result = await fetchStore();
  if (!result.error) {
    cache = { value: result.store, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return result;
}

export async function writeCalendarStore(store: CalendarSyncStore): Promise<{ error: string | null }> {
  if (!supabaseAdmin) {
    return { error: "Supabase is not configured — calendar sync cannot persist." };
  }
  const normalized = normalizeCalendarStore(store);
  const body = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(OBJECT_PATH, body, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) return { error: error.message };
  cache = { value: normalized, expiresAt: Date.now() + CACHE_TTL_MS };
  return { error: null };
}

export async function listCalendarEvents(options?: {
  fromIso?: string;
  toIso?: string;
  matchedOnly?: boolean;
}): Promise<SyncedCalendarEvent[]> {
  const { store } = await readCalendarStore();
  let events = store.events.filter((e) => e.status !== "cancelled");
  if (options?.fromIso) {
    events = events.filter((e) => e.startAt >= options.fromIso! || (e.endAt != null && e.endAt >= options.fromIso!));
  }
  if (options?.toIso) {
    events = events.filter((e) => e.startAt <= options.toIso!);
  }
  if (options?.matchedOnly) {
    events = events.filter((e) => e.matchStatus === "matched");
  }
  return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function listMeetingsForContact(contactId: string): Promise<SyncedCalendarEvent[]> {
  const { store } = await readCalendarStore();
  return store.events
    .filter((e) => e.contactId === contactId && e.status !== "cancelled")
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function listMeetingsForOpportunity(opportunityId: string): Promise<SyncedCalendarEvent[]> {
  const { store } = await readCalendarStore();
  return store.events
    .filter((e) => e.opportunityId === opportunityId && e.status !== "cancelled")
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}
