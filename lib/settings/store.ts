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

/**
 * Nothing saved yet is the normal first-run state, not a failure. Supabase reports it
 * inconsistently (404 status, "Object not found", or an empty error body), so anything
 * without a real message is treated as "no settings written yet".
 */
function storageReadError(error: unknown): string | null {
  const err = (error ?? {}) as { message?: string; status?: number; statusCode?: string | number };
  const status = Number(err.status ?? err.statusCode);
  if (status === 404 || status === 400) return null;
  const message = typeof err.message === "string" ? err.message.trim() : "";
  if (!message || message === "{}") return null;
  return /not found|does not exist/i.test(message) ? null : message;
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

export async function readWorkspaceSettings(): Promise<WorkspaceSettingsRead> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

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
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(OBJECT_PATH);
    if (error) {
      result = { ...result, error: storageReadError(error) };
    } else if (data) {
      const parsed = JSON.parse(await data.text());
      result = { settings: normalizeWorkspaceSettings(parsed), persisted: true, error: null };
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

  const current = await readWorkspaceSettings();
  const merged = normalizeWorkspaceSettings({
    digest: { ...current.settings.digest, ...(patch.digest ?? {}) },
    updatedAt: new Date().toISOString(),
  });

  const body = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(OBJECT_PATH, body, { upsert: true, contentType: "application/json" });

  if (error) {
    return { settings: merged, persisted: false, error: error.message };
  }

  const value: WorkspaceSettingsRead = { settings: merged, persisted: true, error: null };
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
