import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { OrgContactMatchHow } from "./match-org-contacts";

/**
 * Pending Gmail → organization contact suggestions.
 * JSON in Supabase Storage so approval does not need a schema migration.
 * Falls back to `.data/gmail-contact-suggestions.json` when Supabase is not configured.
 */

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "gmail-contact-suggestions/v1.json";
const LOCAL_PATH = join(process.cwd(), ".data", "gmail-contact-suggestions.json");
const CACHE_TTL_MS = 10_000;
const MAX_SUGGESTIONS = 800;

export type GmailContactSuggestionStatus = "pending" | "approved" | "dismissed";

export type GmailContactSuggestion = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  fullName: string;
  reason: string;
  prompt: string;
  matchHow: OrgContactMatchHow;
  sampleSubject: string | null;
  lastSeenAt: string;
  status: GmailContactSuggestionStatus;
  contactId: string | null;
};

export type GmailContactSuggestionStore = {
  lastScannedAt: string | null;
  lastScanError: string | null;
  suggestions: GmailContactSuggestion[];
};

export const EMPTY_CONTACT_SUGGESTION_STORE: GmailContactSuggestionStore = {
  lastScannedAt: null,
  lastScanError: null,
  suggestions: [],
};

let cache: { value: GmailContactSuggestionStore; expiresAt: number } | null = null;

function normalizeSuggestion(raw: unknown): GmailContactSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.organizationId !== "string" || typeof row.email !== "string") {
    return null;
  }
  const status: GmailContactSuggestionStatus =
    row.status === "approved" || row.status === "dismissed" || row.status === "pending" ? row.status : "pending";
  const matchHow: OrgContactMatchHow =
    row.matchHow === "domain" || row.matchHow === "acronym" || row.matchHow === "name" || row.matchHow === "mention"
      ? row.matchHow
      : "domain";
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: typeof row.organizationName === "string" ? row.organizationName : "Organization",
    email: row.email,
    fullName: typeof row.fullName === "string" ? row.fullName : row.email,
    reason: typeof row.reason === "string" ? row.reason : "",
    prompt: typeof row.prompt === "string" ? row.prompt : "",
    matchHow,
    sampleSubject: typeof row.sampleSubject === "string" ? row.sampleSubject : null,
    lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : new Date().toISOString(),
    status,
    contactId: typeof row.contactId === "string" ? row.contactId : null,
  };
}

export function normalizeContactSuggestionStore(raw: unknown): GmailContactSuggestionStore {
  const source = (raw ?? {}) as Record<string, unknown>;
  const suggestions = Array.isArray(source.suggestions)
    ? source.suggestions.map(normalizeSuggestion).filter((row): row is GmailContactSuggestion => Boolean(row))
    : [];
  return {
    lastScannedAt: typeof source.lastScannedAt === "string" ? source.lastScannedAt : null,
    lastScanError: typeof source.lastScanError === "string" ? source.lastScanError : null,
    suggestions,
  };
}

export function mergeContactSuggestions(
  existing: GmailContactSuggestion[],
  proposed: Array<Omit<GmailContactSuggestion, "status" | "contactId" | "lastSeenAt"> & { lastSeenAt?: string }>,
  nowIso: string
): GmailContactSuggestion[] {
  const byId = new Map(existing.map((row) => [row.id, row]));
  for (const next of proposed) {
    const prev = byId.get(next.id);
    if (!prev) {
      byId.set(next.id, {
        ...next,
        lastSeenAt: next.lastSeenAt ?? nowIso,
        status: "pending",
        contactId: null,
      });
      continue;
    }
    byId.set(next.id, {
      ...prev,
      organizationName: next.organizationName,
      fullName: next.fullName || prev.fullName,
      email: next.email,
      reason: next.reason,
      prompt: next.prompt,
      matchHow: next.matchHow,
      sampleSubject: next.sampleSubject ?? prev.sampleSubject,
      lastSeenAt: next.lastSeenAt ?? nowIso,
    });
  }
  const rows = Array.from(byId.values());
  if (rows.length <= MAX_SUGGESTIONS) return rows;
  const dismissed = rows
    .filter((row) => row.status === "dismissed")
    .sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt));
  const drop = new Set(dismissed.slice(0, rows.length - MAX_SUGGESTIONS).map((row) => row.id));
  return rows.filter((row) => !drop.has(row.id)).slice(0, MAX_SUGGESTIONS);
}

export function invalidateContactSuggestionCache(): void {
  cache = null;
}

function readLocalStoreFile(): GmailContactSuggestionStore {
  try {
    if (!existsSync(LOCAL_PATH)) return EMPTY_CONTACT_SUGGESTION_STORE;
    const text = readFileSync(LOCAL_PATH, "utf8");
    if (!text.trim()) return EMPTY_CONTACT_SUGGESTION_STORE;
    return normalizeContactSuggestionStore(JSON.parse(text));
  } catch {
    return EMPTY_CONTACT_SUGGESTION_STORE;
  }
}

function writeLocalStoreFile(store: GmailContactSuggestionStore): void {
  mkdirSync(join(process.cwd(), ".data"), { recursive: true });
  writeFileSync(LOCAL_PATH, JSON.stringify(normalizeContactSuggestionStore(store), null, 2), "utf8");
}

async function fetchStore(): Promise<{ store: GmailContactSuggestionStore; error: string | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { store: readLocalStoreFile(), error: null };
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
    return { store: EMPTY_CONTACT_SUGGESTION_STORE, error: null };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return {
      store: EMPTY_CONTACT_SUGGESTION_STORE,
      error: `Contact suggestion store read failed (${res.status})${detail ? `: ${detail}` : ""}`,
    };
  }
  const text = await res.text();
  if (!text.trim()) return { store: EMPTY_CONTACT_SUGGESTION_STORE, error: null };
  return { store: normalizeContactSuggestionStore(JSON.parse(text)), error: null };
}

export async function readContactSuggestionStore(options?: { skipCache?: boolean }): Promise<{
  store: GmailContactSuggestionStore;
  error: string | null;
}> {
  if (!options?.skipCache && cache && cache.expiresAt > Date.now()) {
    return { store: cache.value, error: null };
  }
  const result = await fetchStore();
  if (!result.error) {
    cache = { value: result.store, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return result;
}

export async function writeContactSuggestionStore(
  store: GmailContactSuggestionStore
): Promise<{ error: string | null }> {
  const normalized = normalizeContactSuggestionStore(store);
  if (!supabaseAdmin) {
    try {
      writeLocalStoreFile(normalized);
      cache = { value: normalized, expiresAt: Date.now() + CACHE_TTL_MS };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Local contact suggestion write failed" };
    }
  }
  const body = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(OBJECT_PATH, body, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) return { error: error.message };
  cache = { value: normalized, expiresAt: Date.now() + CACHE_TTL_MS };
  return { error: null };
}
