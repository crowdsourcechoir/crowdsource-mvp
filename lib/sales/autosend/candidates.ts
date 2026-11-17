import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { looksLikePersonName } from "@/lib/sales/dedupe";
import { isDoNotProspect } from "@/lib/sales/prospecting/do-not-prospect";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { autoSendSkipReason, componentScore, pacificClock } from "./policy";
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

/** Pending first-touch drafts that clear the automatic-send bar. */
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
    gmail_thread_id: string | null;
  }>(
    items.map((item) => item.opportunity_id),
    async (chunk) =>
      db
        .from("opportunities")
        .select("id, title, organization_id, event_date_estimate, event_or_initiative_name, last_outbound_at, gmail_thread_id")
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
      }>(draftIds, async (chunk) =>
        db.from("outreach_drafts").select("id, contact_id, status, ai_subject, edited_subject").in("id", chunk)
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
    const reason = autoSendSkipReason(
      {
        organizationName: organization.name,
        organizationTypeKey: organization.organization_type_id
          ? typeKeyById.get(organization.organization_type_id) ?? null
          : null,
        doNotProspect: isDoNotProspect(organization.import_metadata),
        existingClient: Boolean(organization.is_existing_client),
        alreadyContacted: Boolean(opportunity.last_outbound_at || opportunity.gmail_thread_id),
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
      eventTitle: opportunity.event_or_initiative_name || opportunity.title,
      eventDate: opportunity.event_date_estimate!,
      score: Number(score!.total_score),
    });
  }
  return candidates;
}
