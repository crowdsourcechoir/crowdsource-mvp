import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  DEFAULT_MARKETING_SETTINGS,
  EMPTY_EMAIL_STATS,
  emptyMarketingStore,
  type AcquisitionSource,
  type MarketingAcquisitionEvent,
  type MarketingCampaign,
  type MarketingDeliveryEvent,
  type MarketingEmail,
  type MarketingPerson,
  type MarketingRecipient,
  type MarketingSegment,
  type MarketingSettings,
  type MarketingStatus,
  type MarketingStore,
} from "./types";

/**
 * Marketing persistence — JSON in Supabase Storage when configured,
 * otherwise `.data/marketing-v1.json` for local/dev.
 * Additive only: never writes Gardens, Blooms/events, or Sales tables.
 */

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "marketing/v1.json";
const CACHE_TTL_MS = 8_000;

let cache: { value: MarketingStore; expiresAt: number; error: string | null } | null = null;

function localPath(): string {
  return path.join(process.cwd(), ".data", "marketing-v1.json");
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim());
}

function normalizePerson(raw: unknown): MarketingPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const email = asString(row.email);
  const normalizedEmail = asString(row.normalizedEmail) ?? (email ? email.toLowerCase() : null);
  const id = asString(row.id);
  if (!id || !email || !normalizedEmail) return null;
  const status = (asString(row.status) ?? "pending") as MarketingStatus;
  const acquisitionSource = (asString(row.acquisitionSource) ?? "manual") as AcquisitionSource;
  return {
    id,
    email,
    normalizedEmail,
    displayName: asString(row.displayName),
    city: asString(row.city),
    region: asString(row.region),
    country: asString(row.country),
    status:
      status === "subscribed" || status === "unsubscribed" || status === "cleaned" || status === "pending"
        ? status
        : "pending",
    marketingConsent: asBool(row.marketingConsent),
    consentAt: asString(row.consentAt),
    consentSource: asString(row.consentSource),
    acquisitionSource,
    acquisitionDetail:
      row.acquisitionDetail && typeof row.acquisitionDetail === "object"
        ? (row.acquisitionDetail as Record<string, unknown>)
        : null,
    tags: asTags(row.tags),
    mailchimpId: asString(row.mailchimpId),
    suppressedAt: asString(row.suppressedAt),
    bounceClass: asString(row.bounceClass),
    createdAt: asString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: asString(row.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeSegment(raw: unknown): MarketingSegment | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  if (!id || !name) return null;
  const rules = Array.isArray(row.rules) ? row.rules : [];
  return {
    id,
    name,
    description: asString(row.description),
    rules: rules
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      .map((r) => ({
        field: (asString(r.field) ?? "status") as MarketingSegment["rules"][number]["field"],
        op: (asString(r.op) ?? "eq") as MarketingSegment["rules"][number]["op"],
        value: r.value as string | boolean | string[],
      })),
    createdAt: asString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: asString(row.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeCampaign(raw: unknown): MarketingCampaign | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  if (!id || !name) return null;
  const status = asString(row.status);
  return {
    id,
    name,
    purpose: asString(row.purpose),
    status: status === "active" || status === "archived" || status === "draft" ? status : "draft",
    createdAt: asString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: asString(row.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeEmail(raw: unknown): MarketingEmail | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const campaignId = asString(row.campaignId);
  if (!id || !campaignId) return null;
  const status = asString(row.status);
  const statsRaw = (row.stats ?? {}) as Record<string, unknown>;
  const blocks = Array.isArray(row.blocks) ? row.blocks : [];
  return {
    id,
    campaignId,
    subject: asString(row.subject) ?? "",
    previewText: asString(row.previewText) ?? "",
    fromName: asString(row.fromName) ?? DEFAULT_MARKETING_SETTINGS.fromName,
    fromEmail: asString(row.fromEmail) ?? "",
    replyTo: asString(row.replyTo),
    blocks: blocks
      .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === "object")
      .map((b) => ({
        id: asString(b.id) ?? `blk_${Math.random().toString(36).slice(2, 8)}`,
        type: (asString(b.type) ?? "rich_text") as MarketingEmail["blocks"][number]["type"],
        props: b.props && typeof b.props === "object" ? (b.props as Record<string, unknown>) : {},
      })),
    segmentId: asString(row.segmentId),
    status:
      status === "draft" ||
      status === "scheduled" ||
      status === "sending" ||
      status === "sent" ||
      status === "cancelled"
        ? status
        : "draft",
    scheduledFor: asString(row.scheduledFor),
    sentAt: asString(row.sentAt),
    stats: {
      queued: typeof statsRaw.queued === "number" ? statsRaw.queued : EMPTY_EMAIL_STATS.queued,
      sent: typeof statsRaw.sent === "number" ? statsRaw.sent : EMPTY_EMAIL_STATS.sent,
      delivered: typeof statsRaw.delivered === "number" ? statsRaw.delivered : EMPTY_EMAIL_STATS.delivered,
      bounced: typeof statsRaw.bounced === "number" ? statsRaw.bounced : EMPTY_EMAIL_STATS.bounced,
      complained: typeof statsRaw.complained === "number" ? statsRaw.complained : EMPTY_EMAIL_STATS.complained,
      opened: typeof statsRaw.opened === "number" ? statsRaw.opened : EMPTY_EMAIL_STATS.opened,
      clicked: typeof statsRaw.clicked === "number" ? statsRaw.clicked : EMPTY_EMAIL_STATS.clicked,
      unsubscribed:
        typeof statsRaw.unsubscribed === "number" ? statsRaw.unsubscribed : EMPTY_EMAIL_STATS.unsubscribed,
    },
    createdAt: asString(row.createdAt) ?? new Date().toISOString(),
    updatedAt: asString(row.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeRecipient(raw: unknown): MarketingRecipient | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const emailId = asString(row.emailId);
  const personId = asString(row.personId);
  const toEmail = asString(row.toEmail);
  if (!id || !emailId || !personId || !toEmail) return null;
  const status = asString(row.status);
  return {
    id,
    emailId,
    personId,
    toEmail,
    providerMessageId: asString(row.providerMessageId),
    status:
      status === "queued" ||
      status === "sent" ||
      status === "delivered" ||
      status === "bounced" ||
      status === "complained" ||
      status === "skipped"
        ? status
        : "queued",
    lastEventAt: asString(row.lastEventAt),
    createdAt: asString(row.createdAt) ?? new Date().toISOString(),
  };
}

function normalizeSettings(raw: unknown): MarketingSettings {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    sendsEnabled: asBool(row.sendsEnabled, DEFAULT_MARKETING_SETTINGS.sendsEnabled),
    fromName: asString(row.fromName) ?? DEFAULT_MARKETING_SETTINGS.fromName,
    fromEmail: asString(row.fromEmail) ?? "",
    replyTo: asString(row.replyTo),
    physicalAddress: asString(row.physicalAddress) ?? "",
    companyName: asString(row.companyName) ?? DEFAULT_MARKETING_SETTINGS.companyName,
    ingestSecret: asString(row.ingestSecret),
  };
}

export function normalizeMarketingStore(raw: unknown): MarketingStore {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    version: 1,
    settings: normalizeSettings(source.settings),
    people: Array.isArray(source.people)
      ? source.people.map(normalizePerson).filter((p): p is MarketingPerson => Boolean(p))
      : [],
    segments: Array.isArray(source.segments)
      ? source.segments.map(normalizeSegment).filter((s): s is MarketingSegment => Boolean(s))
      : [],
    campaigns: Array.isArray(source.campaigns)
      ? source.campaigns.map(normalizeCampaign).filter((c): c is MarketingCampaign => Boolean(c))
      : [],
    emails: Array.isArray(source.emails)
      ? source.emails.map(normalizeEmail).filter((e): e is MarketingEmail => Boolean(e))
      : [],
    recipients: Array.isArray(source.recipients)
      ? source.recipients.map(normalizeRecipient).filter((r): r is MarketingRecipient => Boolean(r))
      : [],
    deliveryEvents: Array.isArray(source.deliveryEvents)
      ? source.deliveryEvents
          .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
          .map(
            (e): MarketingDeliveryEvent => ({
              id: asString(e.id) ?? `dev_${Math.random().toString(36).slice(2, 8)}`,
              recipientId: asString(e.recipientId),
              emailId: asString(e.emailId),
              type: asString(e.type) ?? "unknown",
              meta: e.meta && typeof e.meta === "object" ? (e.meta as Record<string, unknown>) : null,
              occurredAt: asString(e.occurredAt) ?? new Date().toISOString(),
            })
          )
      : [],
    acquisitionEvents: Array.isArray(source.acquisitionEvents)
      ? source.acquisitionEvents
          .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
          .map(
            (e): MarketingAcquisitionEvent => ({
              id: asString(e.id) ?? `acq_${Math.random().toString(36).slice(2, 8)}`,
              personId: asString(e.personId) ?? "",
              source: (asString(e.source) ?? "other") as AcquisitionSource,
              externalId: asString(e.externalId),
              detail: e.detail && typeof e.detail === "object" ? (e.detail as Record<string, unknown>) : null,
              createdAt: asString(e.createdAt) ?? new Date().toISOString(),
            })
          )
          .filter((e) => e.personId)
      : [],
    updatedAt: asString(source.updatedAt),
  };
}

function readLocalFile(): MarketingStore {
  try {
    const p = localPath();
    if (!existsSync(p)) return emptyMarketingStore();
    return normalizeMarketingStore(JSON.parse(readFileSync(p, "utf8")));
  } catch {
    return emptyMarketingStore();
  }
}

/** Local mirror for dev. Never throws — Vercel FS is read-only outside /tmp. */
function writeLocalFile(store: MarketingStore): string | null {
  try {
    const dir = path.dirname(localPath());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(localPath(), JSON.stringify(store, null, 2), "utf8");
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Local write failed";
    return message;
  }
}

async function fetchRemote(): Promise<{ store: MarketingStore; error: string | null }> {
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
    return { store: emptyMarketingStore(), error: null };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return {
      store: readLocalFile(),
      error: `Marketing store read failed (${res.status})${detail ? `: ${detail}` : ""}`,
    };
  }
  const text = await res.text();
  if (!text.trim()) return { store: emptyMarketingStore(), error: null };
  try {
    return { store: normalizeMarketingStore(JSON.parse(text)), error: null };
  } catch {
    return { store: emptyMarketingStore(), error: "Marketing store JSON is invalid." };
  }
}

async function writeRemote(store: MarketingStore): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    const localError = writeLocalFile(store);
    return localError ? `Marketing store write failed: ${localError}` : null;
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
    // Best-effort local mirror (may no-op on read-only hosts).
    writeLocalFile(store);
    return `Marketing store write failed (${res.status})${detail ? `: ${detail}` : ""}`;
  }
  // Remote is source of truth; local mirror is best-effort only.
  writeLocalFile(store);
  return null;
}

export function invalidateMarketingStoreCache(): void {
  cache = null;
}

export async function readMarketingStore(): Promise<{ store: MarketingStore; error: string | null }> {
  if (cache && cache.expiresAt > Date.now()) {
    return { store: cache.value, error: cache.error };
  }
  const result = await fetchRemote();
  cache = { value: result.store, expiresAt: Date.now() + CACHE_TTL_MS, error: result.error };
  return result;
}

export async function updateMarketingStore(
  mutator: (store: MarketingStore) => MarketingStore | void
): Promise<{ store: MarketingStore; error: string | null }> {
  const { store: current, error: readError } = await readMarketingStore();
  if (readError && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Local-only is fine.
  }
  const draft = structuredClone(current) as MarketingStore;
  const maybe = mutator(draft);
  const next = maybe ?? draft;
  next.updatedAt = new Date().toISOString();
  next.version = 1;
  const writeError = await writeRemote(next);
  cache = { value: next, expiresAt: Date.now() + CACHE_TTL_MS, error: writeError };
  return { store: next, error: writeError };
}
