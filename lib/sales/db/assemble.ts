import { requireSupabaseAdmin } from "./client";
import { getOpportunity, listOpportunitiesInFunnel } from "./opportunities";
import { getOrganization } from "./organizations";
import { getContact, listContactsForOrganization } from "./contacts";
import { getDraft, listDraftsForOpportunity } from "./outreach";
import { listFindingsWithSourcesForOpportunity } from "./research";
import { getQueueItemByOpportunity, getInitialQueueItemByOpportunity } from "./queue";
import { getLatestBriefForOpportunity } from "./pipeline";
import { listActivitiesForOpportunity } from "./activities";
import { hasVerifiedEmail, looksLikePersonName } from "../dedupe";
import type { ApprovalQueueItem, Contact, FunnelItemDetail, OpportunityPageDetail, QueueItemDetail } from "../types";

function looksLikeSelectableContact(c: Contact): boolean {
  return Boolean(looksLikePersonName(c.fullName) && c.email);
}

function emptyQueueItem(opportunityId: string, createdAt: string): ApprovalQueueItem {
  return {
    id: "",
    opportunityId,
    outreachDraftId: null,
    prospectScoreId: null,
    kind: "initial",
    duplicateWarning: false,
    status: "pending",
    decisionNotes: null,
    decidedBy: null,
    decidedAt: null,
    deferredUntil: null,
    createdAt,
  };
}

function pickBestContact(contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;
  const ranked = [...contacts].sort((a, b) => {
    const emailRank = (c: Contact) => (hasVerifiedEmail(c) ? 0 : c.email ? 1 : 2);
    return emailRank(a) - emailRank(b);
  });
  return ranked[0] ?? null;
}

function buildSourceLinks(
  organizationWebsiteUrl: string | null,
  findings: { claimType: string; sourceUrl: string }[]
): OpportunityPageDetail["links"] {
  const links: OpportunityPageDetail["links"] = [];
  const seen = new Set<string>();

  const push = (url: string, label: string, kind: OpportunityPageDetail["links"][number]["kind"]) => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    links.push({ url: trimmed, label, kind });
  };

  if (organizationWebsiteUrl) push(organizationWebsiteUrl, "Organization website", "organization");

  for (const f of findings) {
    if (!f.sourceUrl) continue;
    const url = f.sourceUrl;
    const lower = url.toLowerCase();
    const isConference =
      f.claimType === "event_date" ||
      /conference|event|exhibit|national-|\/events\//i.test(lower);
    if (isConference) {
      let label = "Conference page";
      try {
        const path = new URL(url).pathname.replace(/\/$/, "");
        const last = path.split("/").filter(Boolean).pop();
        if (last) label = last.replace(/[-_]/g, " ");
      } catch {
        // keep default label
      }
      push(url, label, "conference");
    }
  }

  // A few other research pages if we still have room (skip org homepage duplicates).
  for (const f of findings) {
    if (links.length >= 8) break;
    if (!f.sourceUrl || f.claimType === "event_date") continue;
    const lower = f.sourceUrl.toLowerCase();
    if (/conference|event|exhibit|national-|\/events\//i.test(lower)) continue;
    push(f.sourceUrl, "Research source", "research");
  }

  return links;
}

async function buildDetail(opportunityId: string, queueItem: ApprovalQueueItem | null): Promise<QueueItemDetail | null> {
  const db = requireSupabaseAdmin();
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) return null;

  const [organization, findings, brief] = await Promise.all([
    getOrganization(opportunity.organizationId),
    listFindingsWithSourcesForOpportunity(opportunity.organizationId, opportunity.id),
    getLatestBriefForOpportunity(opportunityId),
  ]);
  if (!organization) return null;

  const orgContacts = await listContactsForOrganization(opportunity.organizationId);
  const draft = queueItem?.outreachDraftId ? await getDraft(queueItem.outreachDraftId) : null;
  let contact = draft?.contactId ? await getContact(draft.contactId) : null;
  if (!contact) {
    contact = pickBestContact(orgContacts);
  }

  // Email-ready named people for the queue picker (verified format or any email).
  const contacts = orgContacts.filter((c) => looksLikeSelectableContact(c));
  const allDrafts = await listDraftsForOpportunity(opportunity.id);
  const contactDrafts = allDrafts.filter(
    (d) => d.kind === "initial" && d.contactId && contacts.some((c) => c.id === d.contactId)
  );

  let score = null;
  if (queueItem?.prospectScoreId) {
    const { data } = await db.from("prospect_scores").select("*").eq("id", queueItem.prospectScoreId).maybeSingle();
    if (data) {
      score = {
        id: data.id,
        opportunityId: data.opportunity_id,
        pipelineRunId: data.pipeline_run_id,
        totalScore: Number(data.total_score),
        componentScores: data.component_scores,
        rationale: data.rationale,
        confidence: data.confidence,
        missingInformation: data.missing_information ?? [],
        model: data.model,
        createdAt: data.created_at,
      };
    }
  }
  if (!score) {
    const { data } = await db
      .from("prospect_scores")
      .select("*")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      score = {
        id: data.id,
        opportunityId: data.opportunity_id,
        pipelineRunId: data.pipeline_run_id,
        totalScore: Number(data.total_score),
        componentScores: data.component_scores,
        rationale: data.rationale,
        confidence: data.confidence,
        missingInformation: data.missing_information ?? [],
        model: data.model,
        createdAt: data.created_at,
      };
    }
  }

  let opportunityTypeLabel: string | null = null;
  if (opportunity.opportunityTypeId) {
    const { data } = await db.from("opportunity_types").select("label").eq("id", opportunity.opportunityTypeId).maybeSingle();
    opportunityTypeLabel = data?.label ?? null;
  }
  let organizationTypeLabel: string | null = null;
  if (organization.organizationTypeId) {
    const { data } = await db.from("organization_types").select("label").eq("id", organization.organizationTypeId).maybeSingle();
    organizationTypeLabel = data?.label ?? null;
  }

  return {
    queueItem: queueItem ?? emptyQueueItem(opportunity.id, opportunity.createdAt),
    opportunity,
    opportunityTypeLabel,
    organization,
    organizationTypeLabel,
    contact,
    contacts,
    contactDrafts,
    score,
    brief,
    draft,
    findings,
  };
}

/** Everything the review UI needs for one opportunity (uses pending/latest queue row). */
export async function assembleQueueItemDetail(opportunityId: string): Promise<QueueItemDetail | null> {
  const queueItem = await getQueueItemByOpportunity(opportunityId);
  return buildDetail(opportunityId, queueItem);
}

/** Assemble from a specific queue row (required when multiple items exist per opportunity). */
export async function assembleQueueItemDetailFromQueueItem(queueItem: ApprovalQueueItem): Promise<QueueItemDetail | null> {
  return buildDetail(queueItem.opportunityId, queueItem);
}

/** Funnel / opportunity deep-link page — adds contacts, send status, and useful links. */
export async function assembleOpportunityPageDetail(opportunityId: string): Promise<OpportunityPageDetail | null> {
  // Prefer the initial (approved) queue row so the page shows the outreach that was actually sent,
  // not a pending nudge draft that might temporarily be the "latest" pending item.
  const initial = await getInitialQueueItemByOpportunity(opportunityId);
  const detail = initial
    ? await buildDetail(opportunityId, initial)
    : await assembleQueueItemDetail(opportunityId);
  if (!detail) return null;

  const [contacts, activities] = await Promise.all([
    listContactsForOrganization(detail.organization.id),
    listActivitiesForOpportunity(opportunityId).catch(() => []),
  ]);

  const sent = [...activities].reverse().find((a) => a.activityType === "sent");
  const replied = [...activities].reverse().find((a) => a.activityType === "replied");

  const contact =
    detail.contact ??
    (detail.draft?.contactId ? contacts.find((c) => c.id === detail.draft!.contactId) ?? null : null) ??
    pickBestContact(contacts);

  return {
    ...detail,
    contact,
    contacts,
    emailSentAt: sent?.occurredAt ?? detail.opportunity.lastOutboundAt,
    emailRepliedAt: replied?.occurredAt ?? detail.opportunity.lastInboundAt,
    links: buildSourceLinks(detail.organization.websiteUrl, detail.findings),
  };
}

function needsNudge(opportunity: {
  nextFollowUpAt: string | null;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  relationshipStage: string | null;
}): boolean {
  if (!opportunity.nextFollowUpAt) return false;
  if (opportunity.relationshipStage === "lost" || opportunity.relationshipStage === "purchase") return false;
  if (new Date(opportunity.nextFollowUpAt).getTime() > Date.now()) return false;
  if (!opportunity.lastOutboundAt) return false;
  if (!opportunity.lastInboundAt) return true;
  return new Date(opportunity.lastInboundAt).getTime() < new Date(opportunity.lastOutboundAt).getTime();
}

/** Everything /admin/sales/funnel needs, for every opportunity with a non-null relationship_stage. */
export async function assembleFunnelItems(): Promise<FunnelItemDetail[]> {
  const opportunities = await listOpportunitiesInFunnel();
  const details = await Promise.all(
    opportunities.map(async (opportunity): Promise<FunnelItemDetail | null> => {
      const [organization, queueItem] = await Promise.all([
        getOrganization(opportunity.organizationId),
        getInitialQueueItemByOpportunity(opportunity.id),
      ]);
      if (!organization) return null;

      const draft = queueItem?.outreachDraftId ? await getDraft(queueItem.outreachDraftId) : null;
      let contact = draft?.contactId ? await getContact(draft.contactId) : null;
      if (!contact) {
        contact = pickBestContact(await listContactsForOrganization(organization.id));
      }

      return {
        opportunity,
        organization,
        contact,
        draft,
        approvedAt: queueItem?.decidedAt ?? null,
        needsNudge: needsNudge(opportunity),
      };
    })
  );
  return details.filter((d): d is FunnelItemDetail => d !== null);
}
