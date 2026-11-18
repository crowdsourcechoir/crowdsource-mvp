import { supabaseAdmin } from "@/lib/supabase-server";
import { AUTO_SEND_LANES, classifyAutoSendLane, type AutoSendLane } from "./policy";
import type { AutoSendLaneCounts, AutoSendSlot, AutoSendSlotStatus, AutoSendState } from "./types";

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
const OBJECT_PATH = "sales-autosend/plan-v1.json";

const STATUSES = new Set<AutoSendSlotStatus>(["queued", "sending", "sent", "drafted", "failed", "skipped"]);

export const EMPTY_AUTO_SEND_STATE: AutoSendState = {
  enabled: true,
  updatedAt: null,
  slots: [],
  reports: [],
  ready: null,
};

function asLane(value: unknown, organizationName: string, eventTitle: string): AutoSendLane {
  if (typeof value === "string" && (AUTO_SEND_LANES as readonly string[]).includes(value)) return value as AutoSendLane;
  return classifyAutoSendLane({ organizationName, eventTitle });
}

function asReady(value: unknown): AutoSendLaneCounts | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const counts: AutoSendLaneCounts = { large: 0, sponsorship: 0, partnership: 0, other: 0 };
  let any = false;
  for (const lane of AUTO_SEND_LANES) {
    const count = row[lane];
    if (typeof count === "number" && Number.isFinite(count)) {
      counts[lane] = count;
      any = true;
    }
  }
  return any ? counts : null;
}

function asSlot(value: unknown): AutoSendSlot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const status = row.status;
  if (typeof row.queueItemId !== "string" || typeof row.day !== "string" || typeof row.scheduledAt !== "string") {
    return null;
  }
  if (typeof status !== "string" || !STATUSES.has(status as AutoSendSlotStatus)) return null;
  return {
    queueItemId: row.queueItemId,
    opportunityId: typeof row.opportunityId === "string" ? row.opportunityId : "",
    organizationId: typeof row.organizationId === "string" ? row.organizationId : "",
    organizationName: typeof row.organizationName === "string" ? row.organizationName : "Organization",
    contactName: typeof row.contactName === "string" ? row.contactName : null,
    contactEmail: typeof row.contactEmail === "string" ? row.contactEmail : "",
    subject: typeof row.subject === "string" ? row.subject : "",
    body: typeof row.body === "string" ? row.body : null,
    suggestedFee: typeof row.suggestedFee === "number" && Number.isFinite(row.suggestedFee) ? row.suggestedFee : null,
    eventTitle: typeof row.eventTitle === "string" ? row.eventTitle : "",
    eventDate: typeof row.eventDate === "string" ? row.eventDate : "",
    score: typeof row.score === "number" && Number.isFinite(row.score) ? row.score : 0,
    lane: asLane(
      row.lane,
      typeof row.organizationName === "string" ? row.organizationName : "",
      typeof row.eventTitle === "string" ? row.eventTitle : ""
    ),
    day: row.day,
    scheduledAt: row.scheduledAt,
    status: status as AutoSendSlotStatus,
    statusSince: typeof row.statusSince === "string" ? row.statusSince : null,
    sentAt: typeof row.sentAt === "string" ? row.sentAt : null,
    draftUrl: typeof row.draftUrl === "string" ? row.draftUrl : null,
    gmailDraftId: typeof row.gmailDraftId === "string" ? row.gmailDraftId : null,
    error: typeof row.error === "string" ? row.error : null,
    attempts: typeof row.attempts === "number" && Number.isFinite(row.attempts) ? row.attempts : 0,
  };
}

export function normalizeAutoSendState(value: unknown): AutoSendState {
  if (!value || typeof value !== "object") return { ...EMPTY_AUTO_SEND_STATE };
  const row = value as Record<string, unknown>;
  const slots = Array.isArray(row.slots) ? row.slots.map(asSlot).filter((slot): slot is AutoSendSlot => Boolean(slot)) : [];
  const reports = Array.isArray(row.reports)
    ? row.reports
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const mark = item as Record<string, unknown>;
          if (typeof mark.day !== "string" || typeof mark.sentAt !== "string") return null;
          return { day: mark.day, sentAt: mark.sentAt };
        })
        .filter((mark): mark is { day: string; sentAt: string } => Boolean(mark))
    : [];
  return {
    enabled: row.enabled !== false,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
    slots,
    reports,
    ready: asReady(row.ready),
  };
}

async function fetchState(): Promise<{ state: AutoSendState; error: string | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return { state: EMPTY_AUTO_SEND_STATE, error: "Supabase is not configured." };

  const url = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${OBJECT_PATH}?ts=${Date.now()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Cache-Control": "no-cache",
    },
  });
  if (res.status === 404 || res.status === 400) return { state: EMPTY_AUTO_SEND_STATE, error: null };
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return { state: EMPTY_AUTO_SEND_STATE, error: `Auto-send plan read failed (${res.status})${detail ? `: ${detail}` : ""}` };
  }
  const text = await res.text();
  if (!text.trim()) return { state: EMPTY_AUTO_SEND_STATE, error: null };
  return { state: normalizeAutoSendState(JSON.parse(text)), error: null };
}

export async function readAutoSendState(): Promise<{ state: AutoSendState; error: string | null }> {
  return fetchState();
}

export async function writeAutoSendState(state: AutoSendState): Promise<{ error: string | null }> {
  const normalized = normalizeAutoSendState({ ...state, updatedAt: new Date().toISOString() });
  if (!supabaseAdmin) return { error: "Supabase is not configured." };
  const body = new Blob([JSON.stringify(normalized)], { type: "application/json" });
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(OBJECT_PATH, body, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) return { error: error.message };
  return { error: null };
}
