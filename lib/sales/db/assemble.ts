import { requireSupabaseAdmin } from "./client";
import { getOpportunity, listOpportunitiesInFunnel } from "./opportunities";
import { getOrganization } from "./organizations";
import { getContact } from "./contacts";
import { getDraft } from "./outreach";
import { listFindingsWithSourcesForOpportunity } from "./research";
import { getQueueItemByOpportunity } from "./queue";
import { getLatestBriefForOpportunity } from "./pipeline";
import type { FunnelItemDetail, QueueItemDetail } from "../types";

/** Everything the review UI needs for one opportunity, assembled in one call so no extra navigation is required. */
export async function assembleQueueItemDetail(opportunityId: string): Promise<QueueItemDetail | null> {
  const db = requireSupabaseAdmin();
  const [opportunity, queueItem] = await Promise.all([getOpportunity(opportunityId), getQueueItemByOpportunity(opportunityId)]);
  if (!opportunity) return null;

  const [organization, findings, brief] = await Promise.all([
    getOrganization(opportunity.organizationId),
    listFindingsWithSourcesForOpportunity(opportunity.organizationId, opportunity.id),
    getLatestBriefForOpportunity(opportunityId),
  ]);
  if (!organization) return null;

  const draft = queueItem?.outreachDraftId ? await getDraft(queueItem.outreachDraftId) : null;
  const contact = draft?.contactId ? await getContact(draft.contactId) : null;

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
    queueItem: queueItem ?? {
      id: "",
      opportunityId: opportunity.id,
      outreachDraftId: null,
      prospectScoreId: null,
      duplicateWarning: false,
      status: "pending",
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      deferredUntil: null,
      createdAt: opportunity.createdAt,
    },
    opportunity,
    opportunityTypeLabel,
    organization,
    organizationTypeLabel,
    contact,
    score,
    brief,
    draft,
    findings,
  };
}

/** Everything /admin/sales/funnel needs, for every opportunity with a non-null relationship_stage
 * — reuses the same queue-item→draft→contact join shape as assembleQueueItemDetail above rather
 * than a new one, per the "one shape for opportunity + org + contact + draft" convention. */
export async function assembleFunnelItems(): Promise<FunnelItemDetail[]> {
  const opportunities = await listOpportunitiesInFunnel();
  const details = await Promise.all(
    opportunities.map(async (opportunity): Promise<FunnelItemDetail | null> => {
      const [organization, queueItem] = await Promise.all([
        getOrganization(opportunity.organizationId),
        getQueueItemByOpportunity(opportunity.id),
      ]);
      if (!organization) return null;

      const draft = queueItem?.outreachDraftId ? await getDraft(queueItem.outreachDraftId) : null;
      const contact = draft?.contactId ? await getContact(draft.contactId) : null;

      return { opportunity, organization, contact, draft, approvedAt: queueItem?.decidedAt ?? null };
    })
  );
  return details.filter((d): d is FunnelItemDetail => d !== null);
}
