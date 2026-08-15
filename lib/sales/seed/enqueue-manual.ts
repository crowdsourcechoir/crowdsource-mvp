import { createOpportunity, findExistingOpportunityByTitle, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { createPipelineRun, updatePipelineRun } from "@/lib/sales/db/pipeline";
import { createProspectScore } from "@/lib/sales/db/scores";
import { createOutreachDraft } from "@/lib/sales/db/outreach";
import { createOrUpdateQueueItem } from "@/lib/sales/db/queue";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findOpportunityTypeByKey } from "@/lib/sales/db/lookups";
import { looksLikePersonName, hasVerifiedEmail } from "@/lib/sales/dedupe";
import { computeTotalScore } from "@/lib/sales/scoring/score";
import { SCORE_COMPONENT_KEYS, type Contact, type Organization, type ScoreComponentKey } from "@/lib/sales/types";

export type ManualEnqueueResult = {
  opportunityId: string;
  queueItemId: string;
  prospectScoreId: string;
  outreachDraftId: string;
  primaryContactId: string | null;
  totalScore: number;
};

/** Prefer game-entertainment / marketing doorway contacts for NFL team outreach. */
function pickPrimaryContact(contacts: Contact[]): Contact | null {
  const ready = contacts.filter((c) => looksLikePersonName(c.fullName) && hasVerifiedEmail(c));
  if (ready.length === 0) return null;
  const rank = (c: Contact) => {
    const title = `${c.roleTitle ?? ""} ${c.roleCategory ?? ""}`.toLowerCase();
    if (/game entertainment|special events|entertainment experience/.test(title)) return 0;
    if (/marketing/.test(title)) return 1;
    if (/coo|chief operating/.test(title)) return 2;
    return 5;
  };
  return [...ready].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * When OpenAI credits are exhausted (or AI detect/score/draft can't run), still put a solid
 * lead with verified contacts into the approval queue for human review.
 */
export async function enqueueOrgManually(input: {
  organization: Organization;
  title: string;
  description: string;
  eventOrInitiativeName?: string | null;
  opportunityTypeKey?: string;
  totalScoreHint?: number;
}): Promise<ManualEnqueueResult> {
  const contacts = await listContactsForOrganization(input.organization.id);
  const primary = pickPrimaryContact(contacts);
  if (!primary) {
    throw new Error("No named contact with a verified-format email — cannot enqueue.");
  }

  const oppType = await findOpportunityTypeByKey(input.opportunityTypeKey ?? "fan_engagement_initiative");
  let opportunity = await findExistingOpportunityByTitle(input.organization.id, input.title);
  if (!opportunity) {
    opportunity = await createOpportunity({
      organizationId: input.organization.id,
      opportunityTypeId: oppType?.id ?? null,
      title: input.title,
      eventOrInitiativeName: input.eventOrInitiativeName ?? null,
      description: input.description,
      status: "ready_for_review",
      targetContactRoleHint: primary.roleTitle,
      importMetadata: { enqueuedManually: true, reason: "ai_pipeline_unavailable_or_requested" },
    });
  } else {
    await updateOpportunityStatus(opportunity.id, "ready_for_review");
  }

  const pipelineRun = await createPipelineRun(input.organization.id, "manual");

  const hint = Math.min(95, Math.max(70, input.totalScoreHint ?? 82));
  const perComponent = Math.round((hint / 100) * 10);
  const raw = {} as Record<ScoreComponentKey, { score: number; rationale: string; findingIds: string[] }>;
  for (const key of SCORE_COMPONENT_KEYS) {
    raw[key] = {
      score: perComponent,
      rationale: `Manual enqueue for ${input.organization.name} (AI scoring unavailable).`,
      findingIds: [],
    };
  }
  // Decision-maker access / contact quality higher — we have verified doorway emails.
  raw.decision_maker_access.score = 9;
  raw.contact_quality.score = 9;
  raw.participatory_program_fit.score = 8;
  raw.strategic_value.score = 8;
  const { total, components } = computeTotalScore(raw);

  const score = await createProspectScore({
    opportunityId: opportunity.id,
    pipelineRunId: pipelineRun.id,
    totalScore: total,
    componentScores: components,
    rationale: `Manual queue entry for ${input.organization.name}: verified doorway contacts loaded; AI detect/score skipped (OpenAI credits or forceManualQueue).`,
    confidence: "medium",
    missingInformation: ["AI research brief not generated — review contacts and draft before send."],
    model: "manual",
  });

  const firstName = (primary.fullName ?? "there").split(/\s+/)[0];
  const draft = await createOutreachDraft({
    opportunityId: opportunity.id,
    contactId: primary.id,
    pipelineRunId: pipelineRun.id,
    kind: "initial",
    status: "draft",
    confidenceScore: 0.55,
    aiSubject: `${input.organization.name} — shared-creation anthem for training camp / fan ritual`,
    aiBody: `Hi ${firstName},\n\nWe're Crowdsource / Song Garden — we help teams turn belonging into a shared song fans and community help create live (not a playlist, not a one-way performance).\n\nFor the Seahawks, a natural doorway is training camp and in-stadium ritual: an anthem the crowd helps make, then owns.\n\nWould you or the right teammate take a short look at how this could fit game entertainment / marketing?\n\n— Joel\n\n[Draft seeded manually for queue review — edit before approving.]`,
  });

  const queueItem = await createOrUpdateQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId: draft.id,
    prospectScoreId: score.id,
    duplicateWarning: false,
  });

  await updatePipelineRun(pipelineRun.id, {
    status: "succeeded",
    currentStage: "queue",
    finishedAt: new Date().toISOString(),
  });

  return {
    opportunityId: opportunity.id,
    queueItemId: queueItem.id,
    prospectScoreId: score.id,
    outreachDraftId: draft.id,
    primaryContactId: primary.id,
    totalScore: total,
  };
}
