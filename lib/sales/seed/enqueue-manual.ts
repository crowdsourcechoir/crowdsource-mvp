import { createOpportunity, findExistingOpportunityByTitle, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { createPipelineRun, updatePipelineRun } from "@/lib/sales/db/pipeline";
import { createProspectScore } from "@/lib/sales/db/scores";
import { createOutreachDraft, listDraftsForOpportunity, updateDraftAiCopy } from "@/lib/sales/db/outreach";
import { createOrUpdateQueueItem } from "@/lib/sales/db/queue";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findOpportunityTypeByKey } from "@/lib/sales/db/lookups";
import { looksLikePersonName, hasVerifiedEmail } from "@/lib/sales/dedupe";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { computeTotalScore } from "@/lib/sales/scoring/score";
import { SCORE_COMPONENT_KEYS, type Contact, type Organization, type OutreachDraft, type ScoreComponentKey } from "@/lib/sales/types";

/** Operator-only role blurbs must never ship in the email body (queue UI still shows them). */
const CONTACT_CONTEXT_IN_EMAIL = /\(Context on your seat:/i;

export type ManualEnqueueResult = {
  opportunityId: string;
  queueItemId: string;
  prospectScoreId: string;
  outreachDraftId: string;
  primaryContactId: string | null;
  draftCount: number;
  totalScore: number;
};

function readyContacts(contacts: Contact[]): Contact[] {
  return contacts.filter(
    (c) =>
      looksLikePersonName(c.fullName) &&
      hasVerifiedEmail(c) &&
      c.email &&
      !isOutboundEmailBlocked(c.email)
  );
}

/** Prefer game-entertainment / marketing doorway contacts for NFL team outreach. */
function pickPrimaryContact(contacts: Contact[]): Contact | null {
  const ready = readyContacts(contacts);
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

function draftCopyForContact(orgName: string, contact: Contact): { subject: string; body: string } {
  const firstName = (contact.fullName ?? "there").split(/\s+/)[0];
  const title = (contact.roleTitle ?? "").toLowerCase();

  let angle: string;
  if (/game entertainment|special events|entertainment experience|programming/.test(title)) {
    angle =
      "a natural doorway is training camp and in-stadium ritual: an anthem the crowd helps make, then owns — sitting in game entertainment / fan experience.";
  } else if (/marketing/.test(title)) {
    angle =
      "a natural doorway is brand and belonging: a shared-creation anthem that gives fans identity they help author, not just consume.";
  } else if (/coo|chief operating|operations/.test(title)) {
    angle =
      "this is a club-wide belonging play — operations often helps route the right owners across entertainment and marketing.";
  } else {
    angle =
      "a natural doorway is training camp and game-day ritual: fans helping create an anthem they then own together.";
  }

  return {
    subject: `${orgName} — shared-creation anthem for training camp / fan ritual`,
    body: `Hi ${firstName},\n\nWe're Crowdsource / Song Garden — we help teams turn belonging into a shared song fans and community help create live (not a playlist, not a one-way performance).\n\nFor the Seahawks, ${angle}\n\nWould you or the right teammate take a short look at fit?\n\n— Joel\n\n[Draft for queue review — edit before approving.]`,
  };
}

/** Ensure every email-ready contact has an initial draft; returns drafts and primary draft id. */
export async function ensureContactDrafts(input: {
  organization: Organization;
  opportunityId: string;
  pipelineRunId?: string | null;
}): Promise<{ drafts: OutreachDraft[]; primaryDraft: OutreachDraft; primaryContact: Contact }> {
  const contacts = readyContacts(await listContactsForOrganization(input.organization.id));
  if (contacts.length === 0) {
    throw new Error("No named contact with a verified-format email — cannot enqueue.");
  }
  const primary = pickPrimaryContact(contacts) ?? contacts[0];
  const existing = await listDraftsForOpportunity(input.opportunityId);
  const drafts: OutreachDraft[] = [];

  for (const contact of contacts) {
    const candidates = existing
      .filter((d) => d.kind === "initial" && d.contactId === contact.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const open = candidates.find((d) => d.status === "draft" || d.status === "qa_flagged");
    if (open) {
      const bodyHasContext =
        CONTACT_CONTEXT_IN_EMAIL.test(open.aiBody) ||
        (open.editedBody != null && CONTACT_CONTEXT_IN_EMAIL.test(open.editedBody));
      if (bodyHasContext) {
        const copy = draftCopyForContact(input.organization.name, contact);
        const clearedEdited = open.editedBody != null && CONTACT_CONTEXT_IN_EMAIL.test(open.editedBody);
        drafts.push(
          await updateDraftAiCopy(open.id, {
            aiSubject: copy.subject,
            aiBody: copy.body,
            clearEdited: clearedEdited,
          })
        );
      } else {
        drafts.push(open);
      }
      continue;
    }
    // Never mint a fresh draft after this contact was already approved/sent — that caused
    // multi-approve loops that re-emailed the same person (Tyler spam).
    const alreadyHandled = candidates.find(
      (d) =>
        d.status === "approved" || d.status === "approved_with_edits" || d.status === "rejected"
    );
    if (alreadyHandled) {
      drafts.push(alreadyHandled);
      continue;
    }
    const copy = draftCopyForContact(input.organization.name, contact);
    const created = await createOutreachDraft({
      opportunityId: input.opportunityId,
      contactId: contact.id,
      pipelineRunId: input.pipelineRunId ?? null,
      kind: "initial",
      status: "draft",
      confidenceScore: 0.55,
      aiSubject: copy.subject,
      aiBody: copy.body,
    });
    drafts.push(created);
  }

  const primaryDraft = drafts.find((d) => d.contactId === primary.id) ?? drafts[0];
  return { drafts, primaryDraft, primaryContact: primary };
}

/**
 * When OpenAI credits are exhausted (or AI detect/score/draft can't run), still put a solid
 * lead with verified contacts into the approval queue for human review — one draft per contact.
 */
export async function enqueueOrgManually(input: {
  organization: Organization;
  title: string;
  description: string;
  eventOrInitiativeName?: string | null;
  opportunityTypeKey?: string;
  totalScoreHint?: number;
  /** Reopen a previously rejected/deferred initial queue row (manual operator action only). */
  reopenDecided?: boolean;
}): Promise<ManualEnqueueResult> {
  const contacts = await listContactsForOrganization(input.organization.id);
  const primary = pickPrimaryContact(contacts);
  if (!primary) {
    throw new Error(
      "No named contact with a verified-format email (excluding hard-blocked addresses) — cannot enqueue."
    );
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
    rationale: `Manual queue entry for ${input.organization.name}: ${readyContacts(contacts).length} verified doorway contacts with role context; pick a contact in the queue to review/edit each draft.`,
    confidence: "medium",
    missingInformation: ["AI research brief not generated — review contact role blurbs and drafts before send."],
    model: "manual",
  });

  const { drafts, primaryDraft, primaryContact } = await ensureContactDrafts({
    organization: input.organization,
    opportunityId: opportunity.id,
    pipelineRunId: pipelineRun.id,
  });

  const queueItem = await createOrUpdateQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId: primaryDraft.id,
    prospectScoreId: score.id,
    duplicateWarning: false,
    reopenDecided: Boolean(input.reopenDecided),
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
    outreachDraftId: primaryDraft.id,
    primaryContactId: primaryContact.id,
    draftCount: drafts.length,
    totalScore: total,
  };
}
