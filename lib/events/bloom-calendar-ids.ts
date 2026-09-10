import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Maps Crowdsource Bloom (event) ids → Google Calendar event ids.
 * Avoids a DB migration; survives across deploys via Supabase Storage.
 */

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "google-calendar/bloom-event-ids-v1.json";
const LOCAL_PATH = join(process.cwd(), ".data", "bloom-calendar-ids.json");

export type BloomCalendarIdMap = Record<string, string>;

function normalizeMap(raw: unknown): BloomCalendarIdMap {
  if (!raw || typeof raw !== "object") return {};
  const out: BloomCalendarIdMap = {};
  for (const [bloomId, googleId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof bloomId === "string" && bloomId && typeof googleId === "string" && googleId) {
      out[bloomId] = googleId;
    }
  }
  return out;
}

function readLocal(): BloomCalendarIdMap {
  try {
    if (!existsSync(LOCAL_PATH)) return {};
    return normalizeMap(JSON.parse(readFileSync(LOCAL_PATH, "utf8")));
  } catch {
    return {};
  }
}

function writeLocal(map: BloomCalendarIdMap): void {
  mkdirSync(join(process.cwd(), ".data"), { recursive: true });
  writeFileSync(LOCAL_PATH, JSON.stringify(map, null, 2), "utf8");
}

export async function readBloomCalendarIds(): Promise<BloomCalendarIdMap> {
  if (!supabaseAdmin) return readLocal();
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(OBJECT_PATH);
    if (error || !data) return readLocal();
    const text = await data.text();
    return normalizeMap(JSON.parse(text));
  } catch {
    return readLocal();
  }
}

export async function writeBloomCalendarIds(map: BloomCalendarIdMap): Promise<void> {
  const normalized = normalizeMap(map);
  writeLocal(normalized);
  if (!supabaseAdmin) return;
  const body = JSON.stringify(normalized, null, 2);
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(OBJECT_PATH, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) console.warn("[bloom-calendar] id map upload failed:", error.message);
}

export async function setBloomGoogleEventId(bloomId: string, googleEventId: string): Promise<void> {
  const map = await readBloomCalendarIds();
  map[bloomId] = googleEventId;
  await writeBloomCalendarIds(map);
}

export async function clearBloomGoogleEventId(bloomId: string): Promise<void> {
  const map = await readBloomCalendarIds();
  if (!(bloomId in map)) return;
  delete map[bloomId];
  await writeBloomCalendarIds(map);
}
