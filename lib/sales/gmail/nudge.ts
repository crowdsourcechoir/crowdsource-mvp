import { z } from "zod";
import { callStructured } from "../openai/client";
import { createOutreachActivity, countSentNudgesForContact, listActivitiesForOpportunity } from "../db/activities";
import { getContact } from "../db/contacts";
import { estimateDraftConfidence, formatFeedbackFewShots, listRecentAcceptedEditFeedback } from "../db/feedback";
import { resolveIndustrySegmentIdForOrganization } from "../db/lookups";
import { getOrganization } from "../db/organizations";
import { getOpportunity, listOpportunitiesDueForNudge, updateOpportunityTouchTimestamps } from "../db/opportunities";
import { createOutreachDraft, listDraftsForOpportunity } from "../db/outreach";
import { createNudgeQueueItem, hasPendingNudgeForContact } from "../db/queue";
import { getLatestBriefForOpportunity } from "../db/pipeline";
import { contactGreetingName } from "../dedupe";
import { MAX_NUDGES_PER_OPPORTUNITY, NUDGE_DUE_AFTER_DAYS } from "./constants";
import { contactIdsDueForNudge, nextPendingFollowUpIso } from "../outreach/nudge-due";
import { draftToPlainText, coalesceDraftBody } from "../outreach/email-body-format";
import type { Contact, Opportunity, Organization, OutreachDraft } from "../types";

const NudgeDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type NudgeRunResult = {
  considered: number;
  created: number;
  skipped: { opportunityId: string; contactId?: string; reason: string }[];
  errors: string[];
};

export type ManualNudgeResult =
  | { ok: true; queueItemId: string; draftId: string; contactId: string }
  | { ok: false; error: string };

async function enqueueNudgeDraftForContact(input: {
  opportunity: Opportunity;
  organization: Organization;
  contact: Contact;
  drafts: OutreachDraft[];
  brief: unknown;
}): Promise<{ queueItemId: string; draftId: string } | { skip: string }> {
  const { opportunity, organization, contact, drafts, brief } = input;
  if (await hasPendingNudgeForContact(opportunity.id, contact.id)) {
    return { skip: "pending nudge already in queue" };
  }
  const sentNudges = await countSentNudgesForContact(opportunity.id, contact.id);
  if (sentNudges >= MAX_NUDGES_PER_OPPORTUNITY) {
    return { skip: `already sent ${sentNudges} nudges` };
  }
  if (!contact.email) {
    return { skip: "contact has no email" };
  }

  const prior =
    [...drafts]
      .reverse()
      .find(
        (d) =>
          d.contactId === contact.id &&
          (d.status === "approved" || d.status === "approved_with_edits")
      ) ??
    [...drafts].reverse().find((d) => d.contactId === contact.id && d.kind === "initial") ??
    null;
  if (!prior) {
    return { skip: "no prior draft/contact" };
  }

  const segmentId = await resolveIndustrySegmentIdForOrganization(organization);
  const feedback = await listRecentAcceptedEditFeedback({
    outreachPersona: contact.outreachPersona,
    industrySegmentId: segmentId,
    limit: 5,
  });
  const fewShots = formatFeedbackFewShots(feedback);
  const confidence = estimateDraftConfidence(feedback);
  const priorSubject = prior.editedSubject ?? prior.aiSubject;
  const priorBody = coalesceDraftBody(prior.editedBody, prior.aiBody);
  const firstName = contactGreetingName(contact);

  const result = await callStructured({
    schema: NudgeDraftSchema,
    schemaName: "nudge_draft",
    systemPrompt: `You write a short, warm 1:1 follow-up email for Crowdsource Choir sales. Match Joel's plain-spoken voice — no corporate filler, no "just bumping this," no guilt. 2–4 short paragraphs max. Include a clear soft ask to reconnect. Sign off as Joel DeJong. Do not invent facts about the prospect. ${fewShots}`,
    userContent: JSON.stringify({
      contactFirstName: firstName,
      organizationName: organization.name,
      opportunityTitle: opportunity.title,
      eventOrInitiativeName: opportunity.eventOrInitiativeName,
      brief,
      originalSubject: priorSubject,
      originalBody: draftToPlainText(priorBody),
      nudgeNumber: sentNudges + 1,
    }),
  });

  const subject = result.parsed.subject.startsWith("Re:")
    ? result.parsed.subject
    : `Re: ${priorSubject.replace(/^Re:\s*/i, "")}`;

  const draft = await createOutreachDraft({
    opportunityId: opportunity.id,
    contactId: contact.id,
    pipelineRunId: null,
    kind: "nudge",
    aiSubject: subject,
    aiBody: result.parsed.body,
    status: "qa_passed",
    confidenceScore: confidence,
  });

  const queueItem = await createNudgeQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId: draft.id,
  });

  await createOutreachActivity({
    opportunityId: opportunity.id,
    contactId: contact.id,
    activityType: "follow_up_due",
    metadata: { draftId: draft.id, nudgeNumber: sentNudges + 1, manual: true },
    gmailThreadId: opportunity.gmailThreadId,
  });

  return { queueItemId: queueItem.id, draftId: draft.id };
}

/**
 * Operator-triggered "try again" — draft a nudge now for this opportunity/contact,
 * ignoring the 7-day due window. Still respects max nudges and pending-nudge guards.
 * Never sends — approve in the queue triggers Gmail send.
 */
export async function generateNudgeDraftForOpportunityContact(
  opportunityId: string,
  contactId: string
): Promise<ManualNudgeResult> {
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) return { ok: false, error: "Opportunity not found" };
  if (opportunity.relationshipStage === "purchase" || opportunity.relationshipStage === "lost") {
    return { ok: false, error: "Won/lost opportunities are not nudged" };
  }
  if (!opportunity.lastOutboundAt) {
    return { ok: false, error: "No outbound email yet — send the first draft instead" };
  }

  const contact = await getContact(contactId);
  if (!contact || contact.organizationId !== opportunity.organizationId) {
    return { ok: false, error: "Contact not found on this organization" };
  }

  const organization = await getOrganization(opportunity.organizationId);
  if (!organization) return { ok: false, error: "Organization missing" };

  const [drafts, brief] = await Promise.all([
    listDraftsForOpportunity(opportunity.id),
    getLatestBriefForOpportunity(opportunity.id),
  ]);

  try {
    const result = await enqueueNudgeDraftForContact({
      opportunity,
      organization,
      contact,
      drafts,
      brief,
    });
    if ("skip" in result) return { ok: false, error: result.skip };

    const refreshed = await listActivitiesForOpportunity(opportunity.id);
    await updateOpportunityTouchTimestamps(opportunity.id, {
      nextFollowUpAt: nextPendingFollowUpIso(refreshed, Date.now(), NUDGE_DUE_AFTER_DAYS),
    });

    return {
      ok: true,
      queueItemId: result.queueItemId,
      draftId: result.draftId,
      contactId: contact.id,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not draft nudge" };
  }
}

/**
 * For each due sent email, generate a follow-up draft and enqueue it for human approval.
 * Never sends — approve in the queue triggers send (Gmail if connected).
 */
export async function generateDueNudgeDrafts(): Promise<NudgeRunResult> {
  const dueOpps = await listOpportunitiesDueForNudge();
  const skipped: NudgeRunResult["skipped"] = [];
  const errors: string[] = [];
  let created = 0;
  const nowMs = Date.now();

  for (const opportunity of dueOpps) {
    try {
      const activities = await listActivitiesForOpportunity(opportunity.id);
      const dueContactIds = contactIdsDueForNudge(activities, nowMs, NUDGE_DUE_AFTER_DAYS);
      if (dueContactIds.length === 0) {
        skipped.push({ opportunityId: opportunity.id, reason: "no contact past 7-day window" });
        await updateOpportunityTouchTimestamps(opportunity.id, {
          nextFollowUpAt: nextPendingFollowUpIso(activities, nowMs, NUDGE_DUE_AFTER_DAYS),
        });
        continue;
      }

      const organization = await getOrganization(opportunity.organizationId);
      if (!organization) {
        skipped.push({ opportunityId: opportunity.id, reason: "organization missing" });
        continue;
      }

      const drafts = await listDraftsForOpportunity(opportunity.id);
      const brief = await getLatestBriefForOpportunity(opportunity.id);

      for (const contactId of dueContactIds) {
        const contact = await getContact(contactId);
        if (!contact) {
          skipped.push({ opportunityId: opportunity.id, contactId, reason: "contact missing" });
          continue;
        }
        const result = await enqueueNudgeDraftForContact({
          opportunity,
          organization,
          contact,
          drafts,
          brief,
        });
        if ("skip" in result) {
          skipped.push({ opportunityId: opportunity.id, contactId, reason: result.skip });
          continue;
        }
        created += 1;
      }

      const refreshed = await listActivitiesForOpportunity(opportunity.id);
      await updateOpportunityTouchTimestamps(opportunity.id, {
        nextFollowUpAt: nextPendingFollowUpIso(refreshed, Date.now(), NUDGE_DUE_AFTER_DAYS),
      });
    } catch (err) {
      errors.push(`${opportunity.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { considered: dueOpps.length, created, skipped, errors };
}
