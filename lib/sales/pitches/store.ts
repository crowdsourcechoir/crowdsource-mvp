import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { emptyPitchStore, type PitchSettings, type PitchStore, type PitchTemplate, type SalesPitch } from "./types";

/**
 * Pitch persistence — Supabase Storage when configured, else `.data/sales-pitches-v1.json`.
 * Does not touch Gardens/Blooms tables.
 */

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "sales-pitches/v1.json";
const CACHE_TTL_MS = 8_000;

let cache: { value: PitchStore; expiresAt: number; error: string | null } | null = null;

function localPath(): string {
  return path.join(process.cwd(), ".data", "sales-pitches-v1.json");
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function normalizeTemplate(raw: unknown): PitchTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  const googleSlidesTemplateFileId = asString(row.googleSlidesTemplateFileId);
  if (!id || !name || !googleSlidesTemplateFileId) return null;
  return {
    id,
    name,
    description: asString(row.description),
    googleSlidesTemplateFileId,
    isActive: row.isActive !== false,
    createdAt: asString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: asString(row.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizePitch(raw: unknown): SalesPitch | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const opportunityId = asString(row.opportunityId);
  const organizationId = asString(row.organizationId);
  const protectedToken = asString(row.protectedToken);
  const title = asString(row.title);
  if (!id || !opportunityId || !organizationId || !protectedToken || !title) return null;
  const status = asString(row.status);
  return {
    id,
    opportunityId,
    organizationId,
    organizationName: asString(row.organizationName),
    opportunityTitle: asString(row.opportunityTitle),
    templateId: asString(row.templateId),
    title,
    status:
      status === "draft" ||
      status === "editing" ||
      status === "ready" ||
      status === "shared" ||
      status === "archived"
        ? status
        : "draft",
    promptText: asString(row.promptText),
    googlePresentationId: asString(row.googlePresentationId),
    googleSlidesUrl: asString(row.googleSlidesUrl),
    protectedToken,
    pdfStoragePath: asString(row.pdfStoragePath),
    lastSyncedAt: asString(row.lastSyncedAt),
    createdAt: asString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: asString(row.updatedAt) ?? new Date().toISOString(),
  };
}

export function normalizePitchStore(raw: unknown): PitchStore {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const settingsRaw = (source.settings && typeof source.settings === "object" ? source.settings : {}) as Record<
    string,
    unknown
  >;
  const settings: PitchSettings = {
    defaultTemplateFileId: asString(settingsRaw.defaultTemplateFileId),
  };
  return {
    version: 1,
    settings,
    templates: Array.isArray(source.templates)
      ? source.templates.map(normalizeTemplate).filter((t): t is PitchTemplate => Boolean(t))
      : [],
    pitches: Array.isArray(source.pitches)
      ? source.pitches.map(normalizePitch).filter((p): p is SalesPitch => Boolean(p))
      : [],
    updatedAt: asString(source.updatedAt),
  };
}

function readLocalFile(): PitchStore {
  try {
    const p = localPath();
    if (!existsSync(p)) return emptyPitchStore();
    return normalizePitchStore(JSON.parse(readFileSync(p, "utf8")));
  } catch {
    return emptyPitchStore();
  }
}

function writeLocalFile(store: PitchStore): void {
  const dir = path.dirname(localPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(localPath(), JSON.stringify(store, null, 2), "utf8");
}

async function fetchRemote(): Promise<{ store: PitchStore; error: string | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { store: readLocalFile(), error: null };
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
    return { store: emptyPitchStore(), error: null };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return {
      store: readLocalFile(),
      error: `Pitch store read failed (${res.status})${detail ? `: ${detail}` : ""}`,
    };
  }
  const text = await res.text();
  if (!text.trim()) return { store: emptyPitchStore(), error: null };
  try {
    return { store: normalizePitchStore(JSON.parse(text)), error: null };
  } catch {
    return { store: emptyPitchStore(), error: "Pitch store JSON is invalid." };
  }
}

async function writeRemote(store: PitchStore): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    writeLocalFile(store);
    return null;
  }

  const url = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${OBJECT_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
      "x-upsert": "true",
    },
    body: JSON.stringify(store),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    writeLocalFile(store);
    return `Pitch store write failed (${res.status})${detail ? `: ${detail}` : ""}`;
  }
  writeLocalFile(store);
  return null;
}

export function invalidatePitchStoreCache(): void {
  cache = null;
}

export async function readPitchStore(): Promise<{ store: PitchStore; error: string | null }> {
  if (cache && cache.expiresAt > Date.now()) {
    return { store: cache.value, error: cache.error };
  }
  const result = await fetchRemote();
  cache = { value: result.store, expiresAt: Date.now() + CACHE_TTL_MS, error: result.error };
  return result;
}

export async function updatePitchStore(
  mutator: (store: PitchStore) => PitchStore | void
): Promise<{ store: PitchStore; error: string | null }> {
  const { store: current } = await readPitchStore();
  const draft = structuredClone(current) as PitchStore;
  const maybe = mutator(draft);
  const next = maybe ?? draft;
  next.updatedAt = new Date().toISOString();
  next.version = 1;
  const writeError = await writeRemote(next);
  cache = { value: next, expiresAt: Date.now() + CACHE_TTL_MS, error: writeError };
  return { store: next, error: writeError };
}
