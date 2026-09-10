import { waitUntil } from "@vercel/functions";
import type { Event } from "@/data/mockEvents";
import {
  bloomCalendarRelevantBody,
  deleteBloomGoogleCalendarEvent,
  upsertBloomGoogleCalendarEvent,
  type BloomCalendarFields,
} from "@/lib/events/bloom-calendar";

export function toBloomCalendarFields(event: Event | Record<string, unknown>): BloomCalendarFields {
  const row = event as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    date: String(row.date ?? ""),
    time: String(row.time ?? ""),
    venue: String(row.venue ?? ""),
    address: String(row.address ?? ""),
  };
}

function run(task: () => Promise<unknown>): void {
  try {
    waitUntil(task().catch((err) => console.warn("[bloom-calendar]", err)));
  } catch {
    void task().catch((err) => console.warn("[bloom-calendar]", err));
  }
}

/** Fire-and-forget: push Bloom schedule onto Google Calendar + Sales calendar page. */
export function scheduleBloomCalendarUpsert(event: Event | Record<string, unknown>): void {
  const fields = toBloomCalendarFields(event);
  if (!fields.id || !fields.date) return;
  run(() => upsertBloomGoogleCalendarEvent(fields));
}

export function scheduleBloomCalendarUpsertIfRelevant(
  event: Event | Record<string, unknown>,
  body: Record<string, unknown>
): void {
  if (!bloomCalendarRelevantBody(body)) return;
  scheduleBloomCalendarUpsert(event);
}

export function scheduleBloomCalendarDelete(bloomId: string): void {
  if (!bloomId.trim()) return;
  run(() => deleteBloomGoogleCalendarEvent(bloomId));
}
