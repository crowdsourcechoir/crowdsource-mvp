/**
 * Soft fallback for digest "already emailed" tracking when `last_digested_at`
 * isn't migrated yet. Lives in Supabase Storage so it needs no SQL.
 */
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "sales-digest/digested-queue-ids-v1.json";
const MAX_IDS = 4000;

type DigestedStore = { ids: string[]; updatedAt: string | null };

async function readStore(): Promise<DigestedStore> {
  const db = supabaseAdmin;
  if (!db) return { ids: [], updatedAt: null };
  try {
    const { data, error } = await db.storage.from(BUCKET).download(OBJECT_PATH);
    if (error || !data) return { ids: [], updatedAt: null };
    const parsed = JSON.parse(await data.text()) as Partial<DigestedStore>;
    const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === "string") : [];
    return { ids, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null };
  } catch {
    return { ids: [], updatedAt: null };
  }
}

async function writeStore(ids: string[]): Promise<void> {
  const db = supabaseAdmin;
  if (!db) return;
  const payload: DigestedStore = {
    ids: ids.slice(-MAX_IDS),
    updatedAt: new Date().toISOString(),
  };
  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  await db.storage.from(BUCKET).upload(OBJECT_PATH, body, { upsert: true, contentType: "application/json" });
}

export async function readDigestedQueueItemIds(): Promise<Set<string>> {
  const store = await readStore();
  return new Set(store.ids);
}

export async function appendDigestedQueueItemIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const store = await readStore();
  const next = Array.from(new Set([...store.ids, ...ids]));
  await writeStore(next);
}

/**
 * First-run bootstrap: if the soft store is empty, treat all pending items older
 * than `sinceIso` as already-surfaced so the next digest is net-new only.
 */
export async function bootstrapDigestedIdsIfEmpty(
  pending: { id: string; createdAt: string }[],
  sinceIso: string
): Promise<Set<string>> {
  const existing = await readDigestedQueueItemIds();
  if (existing.size > 0) return existing;
  const oldIds = pending.filter((item) => item.createdAt < sinceIso).map((item) => item.id);
  if (oldIds.length === 0) return existing;
  await appendDigestedQueueItemIds(oldIds);
  return new Set(oldIds);
}
