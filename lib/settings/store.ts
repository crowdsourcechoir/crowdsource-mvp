import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Workspace settings store — operator-editable overrides for env defaults.
 *
 * Persisted as a single JSON object in Supabase Storage so Settings can write
 * app-wide config without a schema migration. Reads degrade to defaults when
 * storage is unavailable, so a missing bucket never breaks the pipeline.
 */

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "workspace-settings/v1.json";
const CACHE_TTL_MS = 15_000;

export type DigestSettingsOverrides = {
  /** null = follow the built-in default (enabled) */
  enabled: boolean | null;
  minScore: number | null;
  targetCount: number | null;
  recipient: string | null;
};

export type WorkspaceSettings = {
  digest: DigestSettingsOverrides;
  updatedAt: string | null;
};

export const EMPTY_WORKSPACE_SETTINGS: WorkspaceSettings = {
  digest: { enabled: null, minScore: null, targetCount: null, recipient: null },
  updatedAt: null,
};

export type WorkspaceSettingsRead = {
  settings: WorkspaceSettings;
  /** True when the values came from storage rather than in-code defaults. */
  persisted: boolean;
  error: string | null;
};

let cache: { value: WorkspaceSettingsRead; expiresAt: number } | null = null;

type StoredSettingsFetch =
  | { status: "found"; value: unknown }
  | { status: "missing" }
  | { status: "error"; error: string };

/**
 * Reads the settings object straight from the Storage API with a unique query string.
 * The SDK's download path is served from a cached object body, which let instances read
 * pre-save values for a minute or more after a change.
 */
async function fetchStoredSettings(): Promise<StoredSettingsFetch> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return { status: "error", error: "Supabase is not configured." };

  const url = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${OBJECT_PATH}?ts=${Date.now()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Cache-Control": "no-cache",
    },
  });

  // Nothing saved yet is the normal first-run state, not a failure.
  if (res.status === 404 || res.status === 400) return { status: "missing" };
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return { status: "error", error: `Settings read failed (${res.status})${detail ? `: ${detail}` : ""}` };
  }

  const text = await res.text();
  if (!text.trim()) return { status: "missing" };
  return { status: "found", value: JSON.parse(text) };
}

function coerceNumber(raw: unknown, min: number, max: number): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function coerceEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export function normalizeWorkspaceSettings(raw: unknown): WorkspaceSettings {
  const source = (raw ?? {}) as Record<string, unknown>;
  const digest = (source.digest ?? {}) as Record<string, unknown>;
  return {
    digest: {
      enabled: typeof digest.enabled === "boolean" ? digest.enabled : null,
      minScore: coerceNumber(digest.minScore, 0, 100),
      targetCount: coerceNumber(digest.targetCount, 1, 100),
      recipient: coerceEmail(digest.recipient),
    },
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function invalidateWorkspaceSettingsCache(): void {
  cache = null;
}

export async function readWorkspaceSettings(options?: { skipCache?: boolean }): Promise<WorkspaceSettingsRead> {
  if (!options?.skipCache && cache && cache.expiresAt > Date.now()) return cache.value;

  let result: WorkspaceSettingsRead = {
    settings: EMPTY_WORKSPACE_SETTINGS,
    persisted: false,
    error: null,
  };

  if (!supabaseAdmin) {
    result = { ...result, error: "Supabase is not configured — settings cannot persist." };
    cache = { value: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  }

  try {
    const fetched = await fetchStoredSettings();
    if (fetched.status === "found") {
      result = { settings: normalizeWorkspaceSettings(fetched.value), persisted: true, error: null };
    } else if (fetched.status === "missing") {
      result = { ...result, error: null };
    } else {
      result = { ...result, error: fetched.error };
    }
  } catch (err) {
    result = { ...result, error: err instanceof Error ? err.message : "Failed to read settings" };
  }

  cache = { value: result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}

export async function writeWorkspaceSettings(
  patch: Partial<{ digest: Partial<DigestSettingsOverrides> }>
): Promise<WorkspaceSettingsRead> {
  if (!supabaseAdmin) {
    return {
      settings: EMPTY_WORKSPACE_SETTINGS,
      persisted: false,
      error: "Supabase is not configured — settings cannot be saved.",
    };
  }

  // Merge onto the stored values, not a cached copy, so a save from another instance is not reverted.
  const current = await readWorkspaceSettings({ skipCache: true });
  const merged = normalizeWorkspaceSettings({
    digest: { ...current.settings.digest, ...(patch.digest ?? {}) },
    updatedAt: new Date().toISOString(),
  });

  const body = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(OBJECT_PATH, body, {
    upsert: true,
    contentType: "application/json",
    // Storage caches object bodies by default, which let other instances read a stale
    // settings file for a while after a save.
    cacheControl: "0",
  });

  if (error) {
    return { settings: merged, persisted: false, error: error.message };
  }

  const value: WorkspaceSettingsRead = { settings: merged, persisted: true, error: null };
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
