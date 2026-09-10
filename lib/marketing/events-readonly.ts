import { supabaseAdmin } from "@/lib/supabase-server";
import { EVENT_DETAIL_SELECT, rowToEvent } from "@/lib/events-db";
import { localEventsGetById, localEventsGetAll } from "@/lib/local-events-store";
import type { EventBlockData } from "./email/render";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

/** READ-ONLY bloom/event lookup for marketing email blocks. Never writes. */
export async function getEventForMarketingBlock(
  eventId: string,
  baseUrl: string
): Promise<EventBlockData | null> {
  try {
    if (USE_LOCAL_EVENTS) {
      const row = localEventsGetById(eventId);
      if (!row) return null;
      const event = rowToEvent(row as unknown as Record<string, unknown>);
      return {
        title: String(event.title ?? "Event"),
        description: event.description ? String(event.description) : null,
        heroImage: event.heroImage ? String(event.heroImage) : null,
        venue: event.venue ? String(event.venue) : null,
        date: event.date ? String(event.date) : null,
        url: `${baseUrl}/e/${String(event.slug ?? "")}`,
        ctaText: event.ctaText ? String(event.ctaText) : "Open event",
      };
    }
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin
      .from("events")
      .select(EVENT_DETAIL_SELECT)
      .eq("id", eventId)
      .maybeSingle();
    if (error || !data) return null;
    const event = rowToEvent(data as unknown as Record<string, unknown>);
    return {
      title: String(event.title ?? "Event"),
      description: event.description ? String(event.description) : null,
      heroImage: event.heroImage ? String(event.heroImage) : null,
      venue: event.venue ? String(event.venue) : null,
      date: event.date ? String(event.date) : null,
      url: `${baseUrl}/e/${String(event.slug ?? "")}`,
      ctaText: event.ctaText ? String(event.ctaText) : "Open event",
    };
  } catch {
    return null;
  }
}

/** READ-ONLY list for the marketing event picker. */
export async function listEventsForMarketingPicker(): Promise<
  { id: string; title: string; slug: string; date: string; venue: string }[]
> {
  try {
    if (USE_LOCAL_EVENTS) {
      return localEventsGetAll().map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        date: row.date,
        venue: row.venue,
      }));
    }
    if (!supabaseAdmin) return [];
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id,title,slug,date,venue")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return data.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "Event"),
      slug: String(row.slug ?? ""),
      date: String(row.date ?? ""),
      venue: String(row.venue ?? ""),
    }));
  } catch {
    return [];
  }
}
