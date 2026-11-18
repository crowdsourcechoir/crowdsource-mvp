import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { readCalendarStore } from "@/lib/sales/calendar/store";
import { readDealType } from "@/lib/sales/business-model";
import { readDealForecast } from "@/lib/sales/engines";
import { looksLikePersonName, normalizeEmail } from "@/lib/sales/dedupe";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { isDoNotProspect } from "@/lib/sales/prospecting/do-not-prospect";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { coalesceDraftBody, coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { readAnthemPricing } from "@/lib/sales/pricing/metadata";
import { autoSendSkipReason, classifyAutoSendLane, componentScore, pacificClock } from "./policy";
import type { AutoSendCandidate } from "./types";

const OPEN_DRAFT = new Set(["draft", "qa_passed"]);
const PAGE = 1000;
const CHUNK = 150;

type QueueRow = {
  id: string;
  opportunity_id: string;
  outreach_draft_id: string | null;
  prospect_score_id: string | null;
  duplicate_warning: boolean | null;
  kind: string | null;
  status: string | null;
};

async function fetchChunks<T>(ids: string[], run: (chunk: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: T[] = [];
  for (let index = 0; index < unique.length; index += CHUNK) {
    const { data, error } = await run(unique.slice(index, index + CHUNK));
    if (error) throw new Error(error.message);
    if (data) out.push(...data);
  }
  return out;
}

async function listPendingInitial(): Promise<QueueRow[]> {
  const db = requireSupabaseAdmin();
  const out: QueueRow[] = [];
  for (let from = 0; from < 5000; from += PAGE) {
    const { data, error } = await db
      .from("approval_queue_items")
      .select("id, opportunity_id, outreach_draft_id, prospect_score_id, duplicate_warning, kind, status")
      .eq("status", "pending")
      .or("kind.eq.initial,kind.is.null")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as QueueRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export type PriorOutreachSuppression = {
  contactedOrgIds: Set<string>;
  contactedContactIds: Set<string>;
  contactedEmails: Set<string>;
};

/**
 * Organization-wide, contact-wide, and calendar-meeting suppression so a prospect we
 * already emailed on another opportunity or met on Google Calendar is never queued again.
 */
export async function loadPriorOutreachSuppression(
  organizationIds: string[],
  contactIds: string[]
): Promise<PriorOutreachSuppression> {
  const db = requireSupabaseAdmin();
  const contactedOrgIds = new Set<string>();
  const contactedContactIds = new Set<string>();
  const contactedEmails = new Set<string>();

  if (organizationIds.length > 0) {
    const orgOpps = await fetchChunks<{
      id: string;
      organization_id: string;
      last_outbound_at: string | null;
      last_inbound_at: string | null;
      gmail_thread_id: string | null;
    }>(organizationIds, async (chunk) =>
      db
        .from("opportunities")
        .select("id, organization_id, last_outbound_at, last_inbound_at, gmail_thread_id")
        .in("organization_id", chunk)
    );
    for (const opp of orgOpps) {
      if (opp.last_outbound_at || opp.last_inbound_at || opp.gmail_thread_id) {
        contactedOrgIds.add(opp.organization_id);
      }
    }
  }

  if (contactIds.length > 0) {
    const activities = await fetchChunks<{
      contact_id: string | null;
      activity_type: string;
    }>(contactIds, async (chunk) =>
      db
        .from("outreach_activities")
        .select("contact_id, activity_type")
        .in("contact_id", chunk)
        .in("activity_type", ["sent", "replied", "approved"])
    );
    for (const activity of activities) {
      if (activity.contact_id) contactedContactIds.add(activity.contact_id);
    }
  }

  try {
    const { store } = await readCalendarStore();
    for (const ev of store.events) {
      if (ev.status === "cancelled") continue;
      if (ev.organizationId) contactedOrgIds.add(ev.organizationId);
      if (ev.contactId) contactedContactIds.add(ev.contactId);
      if (ev.contactEmail) {
        const norm = normalizeEmail(ev.contactEmail);
        if (norm) contactedEmails.add(norm);
      }
      for (const attendee of ev.attendeeEmails ?? []) {
        const norm = normalizeEmail(attendee);
        if (norm) contactedEmails.add(norm);
      }
    }
  } catch {
    // Non-fatal if calendar storage is unavailable.
  }

  return { contactedOrgIds, contactedContactIds, contactedEmails };
}

/** Pending first-touch drafts that clear the $15k+ lineup bar. */
export async function listAutoSendCandidates(now: Date = new Date()): Promise<AutoSendCandidate[]> {
  const today = pacificClock(now).ymd;
  const items = await listPendingInitial();
  if (items.length === 0) return [];
  const db = requireSupabaseAdmin();

  const opportunities = await fetchChunks<{
    id: string;
    title: string;
    organization_id: string;
    event_date_estimate: string | null;
    event_or_initiative_name: string | null;
    last_outbound_at: string | null;
    last_inbound_at: string | null;
    gmail_thread_id: string | null;
    opportunity_type_id: string | null;
    import_metadata: Record<string, unknown> | null;
  }>(
    items.map((item) => item.opportunity_id),
    async (chunk) =>
      db
        .from("opportunities")
        .select(
          "id, title, organization_id, event_date_estimate, event_or_initiative_name, last_outbound_at, last_inbound_at, gmail_thread_id, opportunity_type_id, import_metadata"
        )
        .in("id", chunk)
  );
  const oppById = new Map(opportunities.map((row) => [row.id, row]));

  const organizations = await fetchChunks<{
    id: string;
    name: string;
    organization_type_id: string | null;
    import_metadata: Record<string, unknown> | null;
    is_existing_client: boolean | null;
  }>(
    opportunities.map((row) => row.organization_id),
    async (chunk) =>
      db.from("organizations").select("id, name, organization_type_id, import_metadata, is_existing_client").in("id", chunk)
  );
  const orgById = new Map(organizations.map((row) => [row.id, row]));

  const { data: typeRows, error: typeError } = await db.from("organization_types").select("id, key");
  if (typeError) throw new Error(typeError.message);
  const typeKeyById = new Map(((typeRows ?? []) as { id: string; key: string }[]).map((row) => [row.id, row.key]));

  const { data: opportunityTypeRows, error: opportunityTypeError } = await db.from("opportunity_types").select("id, key");
  if (opportunityTypeError) throw new Error(opportunityTypeError.message);
  const opportunityTypeKeyById = new Map(
    ((opportunityTypeRows ?? []) as { id: string; key: string }[]).map((row) => [row.id, row.key])
  );

  const scoreIds = items.map((item) => item.prospect_score_id).filter((id): id is string => Boolean(id));
  const scores = scoreIds.length
    ? await fetchChunks<{ id: string; total_score: number; component_scores: unknown }>(scoreIds, async (chunk) =>
        db.from("prospect_scores").select("id, total_score, component_scores").in("id", chunk)
      )
    : [];
  const scoreById = new Map(scores.map((row) => [row.id, row]));

  const draftIds = items.map((item) => item.outreach_draft_id).filter((id): id is string => Boolean(id));
  const drafts = draftIds.length
    ? await fetchChunks<{
        id: string;
        contact_id: string | null;
        status: string;
        ai_subject: string | null;
        edited_subject: string | null;
        ai_body: string | null;
        edited_body: string | null;
      }>(draftIds, async (chunk) =>
        db
          .from("outreach_drafts")
          .select("id, contact_id, status, ai_subject, edited_subject, ai_body, edited_body")
          .in("id", chunk)
      )
    : [];
  const draftById = new Map(drafts.map((row) => [row.id, row]));

  const contactIds = drafts.map((row) => row.contact_id).filter((id): id is string => Boolean(id));
  const contacts = contactIds.length
    ? await fetchChunks<{
        id: string;
        full_name: string | null;
        email: string | null;
        email_verification_status: string | null;
      }>(contactIds, async (chunk) =>
        db.from("contacts").select("id, full_name, email, email_verification_status").in("id", chunk)
      )
    : [];
  const contactById = new Map(contacts.map((row) => [row.id, row]));

  const suppression = await loadPriorOutreachSuppression(
    organizations.map((o) => o.id),
    contactIds
  );

  const candidates: AutoSendCandidate[] = [];
  for (const item of items) {
    const opportunity = oppById.get(item.opportunity_id);
    if (!opportunity) continue;
    const organization = orgById.get(opportunity.organization_id);
    if (!organization) continue;
    const score = item.prospect_score_id ? scoreById.get(item.prospect_score_id) : undefined;
    const draft = item.outreach_draft_id ? draftById.get(item.outreach_draft_id) : undefined;
    const contact = draft?.contact_id ? contactById.get(draft.contact_id) : undefined;
    const email = contact?.email?.trim() || null;
    const normalizedEmail = normalizeEmail(email);
    const organizationTypeKey = organization.organization_type_id
      ? typeKeyById.get(organization.organization_type_id) ?? null
      : null;
    const eventTitle = opportunity.event_or_initiative_name || opportunity.title;
    const pricing = readAnthemPricing(opportunity.import_metadata);
    const potentialAmount = readDealForecast(opportunity.import_metadata).potentialAmount;
    const suggestedFee = pricing.suggestedAnthemFee ?? potentialAmount ?? null;
    const laneInput = {
      organizationName: organization.name,
      eventTitle,
      organizationTypeKey,
      opportunityTypeKey: opportunity.opportunity_type_id
        ? opportunityTypeKeyById.get(opportunity.opportunity_type_id) ?? null
        : null,
      salesInitiative: readSalesInitiative(organization.import_metadata),
      suggestedFee: pricing.suggestedAnthemFee,
      potentialAmount,
      dealType: readDealType(opportunity.import_metadata) ?? readDealType(organization.import_metadata),
    };
    const alreadyContacted = Boolean(
      opportunity.last_outbound_at ||
        opportunity.last_inbound_at ||
        opportunity.gmail_thread_id ||
        suppression.contactedOrgIds.has(organization.id) ||
        (contact && suppression.contactedContactIds.has(contact.id)) ||
        (normalizedEmail && suppression.contactedEmails.has(normalizedEmail))
    );
    const reason = autoSendSkipReason(
      {
        ...laneInput,
        doNotProspect: isDoNotProspect(organization.import_metadata),
        existingClient: Boolean(organization.is_existing_client),
        alreadyContacted,
        duplicateWarning: Boolean(item.duplicate_warning),
        eventDate: opportunity.event_date_estimate,
        totalScore: score ? Number(score.total_score) : null,
        audienceScore: score ? componentScore(score.component_scores, "audience_size") : null,
        budgetScore: score ? componentScore(score.component_scores, "budget_likelihood") : null,
        email,
        emailVerificationStatus: contact?.email_verification_status ?? null,
        personName: looksLikePersonName(contact?.full_name),
        draftOpen: Boolean(draft && OPEN_DRAFT.has(draft.status)),
        blockedEmail: email ? isOutboundEmailBlocked(email) : false,
        queueKind: item.kind ?? "initial",
        queueStatus: item.status ?? "pending",
      },
      today
    );
    if (reason) continue;
    candidates.push({
      queueItemId: item.id,
      opportunityId: opportunity.id,
      organizationId: organization.id,
      organizationName: organization.name,
      contactName: contact?.full_name ?? null,
      contactEmail: email!,
      subject: coalesceDraftSubject(draft?.edited_subject, draft?.ai_subject),
      body: coalesceDraftBody(draft?.edited_body, draft?.ai_body),
      suggestedFee,
      eventTitle,
      eventDate: opportunity.event_date_estimate ?? "",
      score: Number(score!.total_score),
      lane: classifyAutoSendLane(laneInput),
    });
  }
  return candidates;
}
