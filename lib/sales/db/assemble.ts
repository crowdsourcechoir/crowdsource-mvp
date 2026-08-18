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
import type { ApprovalQueueItem, Contact, FunnelItemDetail, OpportunityPageDetail, ProspectScore, QueueItemDetail } from "../types";

function looksLikeSelectableContact(c: Contact): boolean {
  if (c.duplicateOfContactId) return false;
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

function scoreFromRow(data: Record<string, unknown>): ProspectScore {
  return {
    id: data.id as string,
    opportunityId: data.opportunity_id as string,
    pipelineRunId: data.pipeline_run_id as string,
    totalScore: Number(data.total_score),
    componentScores: data.component_scores as ProspectScore["componentScores"],
    rationale: (data.rationale as string) ?? "",
    confidence: data.confidence as ProspectScore["confidence"],
    missingInformation: (data.missing_information as string[] | null) ?? [],
    model: (data.model as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

async function buildDetail(opportunityId: string, queueItem: ApprovalQueueItem | null): Promise<QueueItemDetail | null> {
  const db = requireSupabaseAdmin();
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) return null;

  const scoreQuery = queueItem?.prospectScoreId
    ? db.from("prospect_scores").select("*").eq("id", queueItem.prospectScoreId).maybeSingle()
    : db
        .from("prospect_scores")
        .select("*")
        .eq("opportunity_id", opportunity.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const [organization, findings, brief, orgContacts, draft, allDrafts, scoreRes, oppTypeRes] = await Promise.all([
    getOrganization(opportunity.organizationId),
    listFindingsWithSourcesForOpportunity(opportunity.organizationId, opportunity.id),
    getLatestBriefForOpportunity(opportunityId),
    listContactsForOrganization(opportunity.organizationId),
    queueItem?.outreachDraftId ? getDraft(queueItem.outreachDraftId) : Promise.resolve(null),
    listDraftsForOpportunity(opportunity.id),
    scoreQuery,
    opportunity.opportunityTypeId
      ? db.from("opportunity_types").select("label").eq("id", opportunity.opportunityTypeId).maybeSingle()
      : Promise.resolve({ data: null as { label: string } | null }),
  ]);
  if (!organization) return null;

  const orgTypeRes = organization.organizationTypeId
    ? await db.from("organization_types").select("label").eq("id", organization.organizationTypeId).maybeSingle()
    : { data: null as { label: string } | null };

  const contacts = orgContacts.filter((c) => looksLikeSelectableContact(c));
  const contact =
    (draft?.contactId ? orgContacts.find((c) => c.id === draft.contactId) ?? null : null) ??
    pickBestContact(orgContacts);

  const latestByContact = new Map<string, (typeof allDrafts)[number]>();
  const selectableIds = new Set(contacts.map((c) => c.id));
  for (const d of allDrafts) {
    if (d.kind !== "initial" || !d.contactId) continue;
    if (!selectableIds.has(d.contactId)) continue;
    const prev = latestByContact.get(d.contactId);
    if (!prev || new Date(d.createdAt).getTime() >= new Date(prev.createdAt).getTime()) {
      latestByContact.set(d.contactId, d);
    }
  }

  const scoreRow = (scoreRes.data as Record<string, unknown> | null) ?? null;

  return {
    queueItem: queueItem ?? emptyQueueItem(opportunity.id, opportunity.createdAt),
    opportunity,
    opportunityTypeLabel: oppTypeRes.data?.label ?? null,
    organization,
    organizationTypeLabel: orgTypeRes.data?.label ?? null,
    contact,
    contacts,
    contactDrafts: Array.from(latestByContact.values()),
    score: scoreRow ? scoreFromRow(scoreRow) : null,
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
