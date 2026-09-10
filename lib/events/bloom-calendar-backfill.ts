import { supabaseAdmin } from "@/lib/supabase-server";
import { EVENT_LIST_SELECT, rowToEvent } from "@/lib/events-db";
import { localEventsGetAll } from "@/lib/local-events-store";
import { upsertBloomGoogleCalendarEvent, type BloomCalendarFields } from "@/lib/events/bloom-calendar";
import { readBloomCalendarIds } from "@/lib/events/bloom-calendar-ids";
import { toDateInputValue } from "@/lib/event-datetime-input";

const USE_LOCAL = () => process.env.USE_LOCAL_EVENTS === "true";

/**
 * Ensure Blooms with dates inside the calendar sync window have Google events.
 * Skips blooms already mapped in the id store.
 */
export async function syncBloomsInCalendarWindow(input: {
  timeMin: string;
  timeMax: string;
}): Promise<{ considered: number; upserted: number }> {
  const minDay = input.timeMin.slice(0, 10);
  const maxDay = input.timeMax.slice(0, 10);
  const existing = await readBloomCalendarIds();

  let rows: BloomCalendarFields[] = [];
  if (USE_LOCAL()) {
    rows = localEventsGetAll().map((row) => {
      const e = rowToEvent(row as unknown as Record<string, unknown>);
      return {
        id: String(e.id),
        slug: String(e.slug ?? ""),
        title: String(e.title ?? ""),
        description: String(e.description ?? ""),
        date: String(e.date ?? ""),
        time: String(e.time ?? ""),
        venue: String(e.venue ?? ""),
        address: String(e.address ?? ""),
      };
    });
  } else if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select(EVENT_LIST_SELECT)
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    rows = (data ?? []).map((row) => {
      const e = rowToEvent(row as Record<string, unknown>);
      return {
        id: String(e.id),
        slug: String(e.slug ?? ""),
        title: String(e.title ?? ""),
        description: String(e.description ?? ""),
        date: String(e.date ?? ""),
        time: String(e.time ?? ""),
        venue: String(e.venue ?? ""),
        address: String(e.address ?? ""),
      };
    });
  }

  let considered = 0;
  let upserted = 0;
  for (const bloom of rows) {
    const day = toDateInputValue(bloom.date);
    if (!day || day < minDay || day > maxDay) continue;
    considered += 1;
    // Always upsert so title/time/location edits stay in sync when Sync runs.
    const result = await upsertBloomGoogleCalendarEvent(bloom);
    if (result.ok) {
      upserted += 1;
    } else if (!existing[bloom.id]) {
      console.warn("[bloom-backfill]", bloom.id, result.error);
    }
  }
  return { considered, upserted };
}
