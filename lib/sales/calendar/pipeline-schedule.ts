import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { classifyQueueCategory, type QueueCategoryKey } from "@/lib/sales/queue/category";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { readDealForecast } from "@/lib/sales/engines";
import { SALES_TIME_ZONE, salesTodayParts } from "@/lib/sales/follow-up/calendar";
import type { RelationshipStage } from "@/lib/sales/types";

export type PipelineScheduleEvent = {
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  /** Display name for the event (initiative / title). */
  title: string;
  eventName: string | null;
  description: string | null;
  websiteUrl: string | null;
  eventDateEstimate: string;
  eventDateConfidence: "confirmed" | "estimated" | "unknown" | null;
  category: QueueCategoryKey;
  relationshipStage: RelationshipStage | null;
  queueItemId: string | null;
  potentialAmount: number | null;
  /** Deep link into queue (or org page when not queued). */
  href: string;
};

export type PipelineScheduleDay = {
  date: string;
  events: PipelineScheduleEvent[];
  /** Two or more events same day — schedule conflict to watch. */
  overlap: boolean;
};

const CATEGORY_LABEL: Record<QueueCategoryKey, string> = {
  sports: "Sports",
  conferences: "Conferences",
  fundraisers: "Fundraisers",
  arts: "Arts",
  entertainment: "Entertainment",
  tech: "Tech",
};

export function pipelineCategoryLabel(key: QueueCategoryKey): string {
  return CATEGORY_LABEL[key];
}

export function queueHrefForPipelineEvent(event: {
  queueItemId: string | null;
  organizationId: string;
  category: QueueCategoryKey;
}): string {
  if (event.queueItemId) {
    const params = new URLSearchParams({
      scope: "all",
      item: event.queueItemId,
      category: event.category,
    });
    return `/admin/sales/queue?${params.toString()}`;
  }
  return `/admin/sales/organizations/${encodeURIComponent(event.organizationId)}`;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-start week cells for a month grid (includes padding days). */
export function monthGridDays(year: number, monthIndex0: number): string[] {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const startPad = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const gridStart = new Date(Date.UTC(year, monthIndex0, 1 - startPad));
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    days.push(ymd(d));
  }
  return days;
}

/** Seven days Mon–Sun containing `anchorYmd`. */
export function weekGridDays(anchorYmd: string): string[] {
  const [y, m, d] = anchorYmd.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  const pad = (anchor.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, m - 1, d - pad));
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setUTCDate(start.getUTCDate() + i);
    days.push(ymd(cur));
  }
  return days;
}

export function shiftMonth(year: number, monthIndex0: number, delta: number): { year: number; monthIndex0: number } {
  const d = new Date(Date.UTC(year, monthIndex0 + delta, 1));
  return { year: d.getUTCFullYear(), monthIndex0: d.getUTCMonth() };
}

export function shiftWeek(anchorYmd: string, deltaWeeks: number): string {
  const [y, m, d] = anchorYmd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + deltaWeeks * 7));
  return ymd(date);
}

/**
 * Operator "today" for the pipeline calendar — wall-clock in Sales TZ
 * (America/Chicago), not UTC. Late evening Pacific must not roll the
 * highlighted day forward early.
 */
export function todayYmd(now: Date = new Date(), timeZone: string = SALES_TIME_ZONE): string {
  const { year, month, day } = salesTodayParts(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function groupPipelineByDay(events: PipelineScheduleEvent[]): PipelineScheduleDay[] {
  const map = new Map<string, PipelineScheduleEvent[]>();
  for (const event of events) {
    const bucket = map.get(event.eventDateEstimate) ?? [];
    bucket.push(event);
    map.set(event.eventDateEstimate, bucket);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEvents]) => ({
      date,
      events: dayEvents.sort((a, b) => a.organizationName.localeCompare(b.organizationName)),
      overlap: dayEvents.length > 1,
    }));
}

export async function loadPipelineScheduleEvents(): Promise<PipelineScheduleEvent[]> {
  const db = requireSupabaseAdmin();
  const { data: oppRows, error: oppErr } = await db
    .from("opportunities")
    .select(
      "id, organization_id, title, description, event_or_initiative_name, event_date_estimate, event_date_confidence, relationship_stage, opportunity_type_id, import_metadata"
    )
    .not("event_date_estimate", "is", null)
    .order("event_date_estimate", { ascending: true });
  if (oppErr) throw new Error(oppErr.message);

  const opps = oppRows ?? [];
  if (opps.length === 0) return [];

  const orgIds = Array.from(new Set(opps.map((r) => String(r.organization_id))));
  const oppIds = opps.map((r) => String(r.id));
  const typeIds = Array.from(
    new Set(opps.map((r) => r.opportunity_type_id as string | null).filter((id): id is string => Boolean(id)))
  );

  const orgMetaById = new Map<
    string,
    {
      name: string;
      website_url: string | null;
      domain: string | null;
      organization_type_id: string | null;
      import_metadata: Record<string, unknown> | null;
    }
  >();
  const orgTypeKeyById = new Map<string, string>();
  const oppTypeKeyById = new Map<string, string>();
  const queueItemByOppId = new Map<string, string>();

  for (let i = 0; i < orgIds.length; i += 100) {
    const chunk = orgIds.slice(i, i + 100);
    const { data, error } = await db
      .from("organizations")
      .select("id, name, website_url, domain, organization_type_id, import_metadata")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      orgMetaById.set(String(row.id), {
        name: String(row.name),
        website_url: (row.website_url as string | null) ?? null,
        domain: (row.domain as string | null) ?? null,
        organization_type_id: (row.organization_type_id as string | null) ?? null,
        import_metadata: (row.import_metadata as Record<string, unknown> | null) ?? null,
      });
    }
  }

  const orgTypeIds = Array.from(
    new Set(
      Array.from(orgMetaById.values())
        .map((o) => o.organization_type_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (orgTypeIds.length > 0) {
    const { data, error } = await db.from("organization_types").select("id, key").in("id", orgTypeIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) orgTypeKeyById.set(String(row.id), String(row.key));
  }
  if (typeIds.length > 0) {
    const { data, error } = await db.from("opportunity_types").select("id, key").in("id", typeIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) oppTypeKeyById.set(String(row.id), String(row.key));
  }

  for (let i = 0; i < oppIds.length; i += 100) {
    const chunk = oppIds.slice(i, i + 100);
    const { data, error } = await db
      .from("approval_queue_items")
      .select("id, opportunity_id, status, created_at")
      .in("opportunity_id", chunk)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const pending = new Map<string, string>();
    const any = new Map<string, string>();
    for (const row of data ?? []) {
      const oppId = String(row.opportunity_id);
      const id = String(row.id);
      if (!any.has(oppId)) any.set(oppId, id);
      if (row.status === "pending" && !pending.has(oppId)) pending.set(oppId, id);
    }
    for (const [oppId, id] of Array.from(any.entries())) {
      queueItemByOppId.set(oppId, pending.get(oppId) ?? id);
    }
  }

  const events: PipelineScheduleEvent[] = [];
  for (const row of opps) {
    const eventDateEstimate =
      typeof row.event_date_estimate === "string" ? row.event_date_estimate.slice(0, 10) : null;
    if (!eventDateEstimate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDateEstimate)) continue;

    const organizationId = String(row.organization_id);
    const org = orgMetaById.get(organizationId);
    const organizationName = org?.name ?? "Unknown org";
    const organizationTypeKey = org?.organization_type_id
      ? orgTypeKeyById.get(org.organization_type_id) ?? null
      : null;
    const opportunityTypeKey = row.opportunity_type_id
      ? oppTypeKeyById.get(String(row.opportunity_type_id)) ?? null
      : null;
    const title = String(row.title ?? organizationName);
    const eventName =
      typeof row.event_or_initiative_name === "string" && row.event_or_initiative_name.trim()
        ? row.event_or_initiative_name.trim()
        : title !== organizationName
          ? title
          : null;
    const description =
      typeof row.description === "string" && row.description.trim() ? row.description.trim() : null;
    const websiteRaw = org?.website_url?.trim() || (org?.domain ? `https://${org.domain}` : null);
    const websiteUrl = websiteRaw
      ? /^https?:\/\//i.test(websiteRaw)
        ? websiteRaw
        : `https://${websiteRaw.replace(/^\/+/, "")}`
      : null;
    const category = classifyQueueCategory({
      organizationName,
      opportunityTitle: title,
      opportunityTypeKey,
      organizationTypeKey,
      salesInitiative: readSalesInitiative(org?.import_metadata),
    });
    const queueItemId = queueItemByOppId.get(String(row.id)) ?? null;
    const confidence = row.event_date_confidence;
    const eventDateConfidence =
      confidence === "confirmed" || confidence === "estimated" || confidence === "unknown"
        ? confidence
        : null;
    const potentialAmount = readDealForecast(row.import_metadata as Record<string, unknown> | null).potentialAmount;
    const base = {
      opportunityId: String(row.id),
      organizationId,
      organizationName,
      title,
      eventName,
      description,
      websiteUrl,
      eventDateEstimate,
      eventDateConfidence,
      category,
      relationshipStage: (row.relationship_stage as RelationshipStage | null) ?? null,
      queueItemId,
      potentialAmount,
    };
    events.push({
      ...base,
      href: queueHrefForPipelineEvent(base),
    });
  }

  return events;
}
