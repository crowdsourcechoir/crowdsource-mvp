import { z } from "zod";
import { callStructured } from "../openai/client";
import { createOutreachActivity, countSentNudgesForContact, listActivitiesForOpportunity } from "../db/activities";
import { getContact } from "../db/contacts";
import { estimateDraftConfidence, formatFeedbackFewShots, listRecentAcceptedEditFeedback } from "../db/feedback";
import { resolveIndustrySegmentIdForOrganization } from "../db/lookups";
import { getOrganization } from "../db/organizations";
import { listOpportunitiesDueForNudge, updateOpportunityTouchTimestamps } from "../db/opportunities";
import { createOutreachDraft, listDraftsForOpportunity } from "../db/outreach";
import { createNudgeQueueItem, hasPendingNudgeForContact } from "../db/queue";
import { getLatestBriefForOpportunity } from "../db/pipeline";
import { contactGreetingName } from "../dedupe";
import { MAX_NUDGES_PER_OPPORTUNITY, NUDGE_DUE_AFTER_DAYS } from "./constants";
import { contactIdsDueForNudge, nextPendingFollowUpIso } from "../outreach/nudge-due";
import { draftToPlainText, coalesceDraftBody } from "../outreach/email-body-format";

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
        if (await hasPendingNudgeForContact(opportunity.id, contactId)) {
          skipped.push({ opportunityId: opportunity.id, contactId, reason: "pending nudge already in queue" });
          continue;
        }
        const sentNudges = await countSentNudgesForContact(opportunity.id, contactId);
        if (sentNudges >= MAX_NUDGES_PER_OPPORTUNITY) {
          skipped.push({
            opportunityId: opportunity.id,
            contactId,
            reason: `already sent ${sentNudges} nudges`,
          });
          continue;
        }

        const contact = await getContact(contactId);
        if (!contact?.email) {
          skipped.push({ opportunityId: opportunity.id, contactId, reason: "contact has no email" });
          continue;
        }

        const prior =
          [...drafts]
            .reverse()
            .find(
              (d) =>
                d.contactId === contactId &&
                (d.status === "approved" || d.status === "approved_with_edits")
            ) ??
          [...drafts].reverse().find((d) => d.contactId === contactId && d.kind === "initial") ??
          null;
        if (!prior) {
          skipped.push({ opportunityId: opportunity.id, contactId, reason: "no prior draft/contact" });
          continue;
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

        await createNudgeQueueItem({
          opportunityId: opportunity.id,
          outreachDraftId: draft.id,
        });

        await createOutreachActivity({
          opportunityId: opportunity.id,
          contactId: contact.id,
          activityType: "follow_up_due",
          metadata: { draftId: draft.id, nudgeNumber: sentNudges + 1 },
          gmailThreadId: opportunity.gmailThreadId,
        });
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
