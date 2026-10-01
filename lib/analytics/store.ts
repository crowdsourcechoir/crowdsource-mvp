import { supabaseAdmin } from "@/lib/supabase-server";
import { isVisitEvent, mergeVisit, type VisitEvent } from "@/lib/analytics/model";

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const PREFIX = "analytics/days";

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function eachDay(startMs: number, endMs: number): string[] {
  const days: string[] = [];
  const cursor = new Date(dayKey(startMs) + "T00:00:00.000Z");
  const end = new Date(dayKey(endMs) + "T00:00:00.000Z");
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function readDay(day: string): Promise<{ events: VisitEvent[]; error: string | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { events: [], error: "Supabase is not configured, so visits are not being saved." };
  }
  const url = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${PREFIX}/${day}.json?ts=${Date.now()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Cache-Control": "no-cache",
    },
  });
  if (res.status === 404 || res.status === 400) return { events: [], error: null };
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 180);
    return { events: [], error: `Analytics read failed (${res.status})${detail ? `: ${detail}` : ""}` };
  }
  const text = await res.text();
  if (!text.trim()) return { events: [], error: null };
  try {
    const parsed = JSON.parse(text) as unknown;
    return { events: Array.isArray(parsed) ? parsed.filter(isVisitEvent) : [], error: null };
  } catch {
    return { events: [], error: null };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function saveVisit(event: VisitEvent): Promise<{ ok: boolean; error: string | null }> {
  if (!supabaseAdmin) {
    return { ok: false, error: "Supabase is not configured, so visits are not being saved." };
  }
  const day = dayKey(event.t);
  const path = `${PREFIX}/${day}.json`;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await readDay(day);
    if (current.error) return { ok: false, error: current.error };
    const next = mergeVisit(current.events, event);
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, new Blob([JSON.stringify(next)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
      cacheControl: "0",
    });
    if (error) {
      lastError = error.message;
      await delay(40 * (attempt + 1));
      continue;
    }
    const confirmed = await readDay(day);
    const saved = confirmed.events.find((item) => item.id === event.id && item.ms >= event.ms);
    if (saved) return { ok: true, error: null };
    await delay(40 * (attempt + 1));
  }
  return { ok: false, error: lastError ?? "Could not save the visit." };
}

export async function readVisitsBetween(startMs: number, endMs: number): Promise<{ events: VisitEvent[]; error: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { events: [], error: "Supabase is not configured, so visits are not being saved." };
  }
  const days = eachDay(startMs, endMs);
  const batches = await Promise.all(days.map((day) => readDay(day)));
  const error = batches.find((batch) => batch.error)?.error ?? null;
  const events = batches.flatMap((batch) => batch.events).filter((event) => event.t >= startMs && event.t <= endMs);
  return { events, error };
}
