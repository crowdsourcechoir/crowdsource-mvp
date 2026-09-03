import type { Event } from "@/data/mockEvents";
import { canonicalEventSlug } from "@/lib/event-slug-aliases";
import { localEventsGetBySlug } from "@/lib/local-events-store";
import { supabaseAdmin } from "@/lib/supabase-server";
import { EVENT_DETAIL_SELECT, attachHostedHeroes, rowToEvent } from "@/lib/events-db";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

type EventFetchOptions = {
  /** Skip storage storyboard recovery — participant reads must stay fast under load. */
  publicRead?: boolean;
};

async function fetchEventRow(slug: string, opts?: EventFetchOptions): Promise<Event | null> {
  const canonicalSlug = canonicalEventSlug(slug);
  if (!canonicalSlug.trim()) return null;

  if (USE_LOCAL_EVENTS) {
    const row = localEventsGetBySlug(canonicalSlug);
    return row ? (rowToEvent(row as unknown as Record<string, unknown>) as Event) : null;
  }

  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("events")
    .select(EVENT_DETAIL_SELECT)
    .eq("slug", canonicalSlug)
    .maybeSingle();

  if (error || !data) return null;
  const event = rowToEvent(data as Record<string, unknown>) as Event;
  await attachHostedHeroes([event], { skipStorageScan: opts?.publicRead === true });
  return event;
}

/** Server-side event lookup for metadata and OG image routes. */
export async function getEventBySlugServer(slug: string): Promise<Event | null> {
  return fetchEventRow(slug);
}

/** Fast path for public `/e/[slug]` — no storage hero/storyboard scans on page view. */
export async function getPublicEventBySlugServer(slug: string): Promise<Event | null> {
  return fetchEventRow(slug, { publicRead: true });
}

export type { EventFetchOptions };
