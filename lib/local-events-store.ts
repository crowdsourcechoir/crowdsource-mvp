/**
 * In-memory events store for local testing when USE_LOCAL_EVENTS=true.
 * Persists to .data/local-events.json so events survive server restarts and hot reloads.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  prompt: string;
  hero_image: string;
  hero_image_mode: "bw" | "color";
  landing_headline: string;
  landing_copy: string;
  cta_text: string;
  anthem_completion_message: string;
  allow_audio_video_prompt: boolean;
  agent_theme_id: string | null;
  agent_brief: unknown;
  song_garden_config: unknown;
  world_config?: unknown;
};

const store: EventRow[] = [];
let loaded = false;

function dataPath(): string {
  return path.join(process.cwd(), ".data", "local-events.json");
}

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  const filePath = dataPath();
  if (!existsSync(filePath)) return;
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as EventRow[];
    if (Array.isArray(parsed)) {
      store.length = 0;
      store.push(...parsed);
    }
  } catch {
    // invalid or missing file: keep store empty
  }
}

function persist(): void {
  try {
    const dir = path.dirname(dataPath());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(dataPath(), JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local events: failed to persist:", err);
  }
}

function nextId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function localEventsGetAll(): EventRow[] {
  ensureLoaded();
  return [...store].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function localEventsGetBySlug(slug: string): EventRow | null {
  ensureLoaded();
  return store.find((e) => e.slug === slug) ?? null;
}

export function localEventsGetById(id: string): EventRow | null {
  ensureLoaded();
  return store.find((e) => e.id === id) ?? null;
}

export function localEventsCreate(row: Omit<EventRow, "id">): EventRow {
  ensureLoaded();
  const event: EventRow = {
    ...row,
    id: nextId(),
  };
  store.push(event);
  persist();
  return event;
}

export function localEventsUpdate(
  id: string,
  updates: Partial<Omit<EventRow, "id">>
): EventRow | null {
  ensureLoaded();
  const index = store.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const next = { ...store[index], ...updates };
  store[index] = next;
  persist();
  return next;
}
