import { z } from "zod";
import { callStructured } from "../openai/client";
import { createOutreachActivity, countSentNudgesForOpportunity } from "../db/activities";
import { getContact } from "../db/contacts";
import { estimateDraftConfidence, formatFeedbackFewShots, listRecentAcceptedEditFeedback } from "../db/feedback";
import { resolveIndustrySegmentIdForOrganization } from "../db/lookups";
import { getOrganization } from "../db/organizations";
import {
  isScheduledReconnect,
  listOpportunitiesDueForNudge,
  updateOpportunityTouchTimestamps,
} from "../db/opportunities";
import { createOutreachDraft, listDraftsForOpportunity } from "../db/outreach";
import { createNudgeQueueItem, hasPendingNudgeQueueItem } from "../db/queue";
import { getLatestBriefForOpportunity } from "../db/pipeline";
import { MAX_NUDGES_PER_OPPORTUNITY } from "./constants";

const NudgeDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type NudgeRunResult = {
  considered: number;
  created: number;
  skipped: { opportunityId: string; reason: string }[];
  errors: string[];
};

/**
 * For each due opportunity, generate a follow-up draft and enqueue it for human approval.
 * Never sends — approve in the queue triggers Gmail send in-thread.
 */
export async function generateDueNudgeDrafts(): Promise<NudgeRunResult> {
  const due = await listOpportunitiesDueForNudge();
  const skipped: { opportunityId: string; reason: string }[] = [];
  const errors: string[] = [];
  let created = 0;

  for (const opportunity of due) {
    try {
      if (await hasPendingNudgeQueueItem(opportunity.id)) {
        skipped.push({ opportunityId: opportunity.id, reason: "pending nudge already in queue" });
        continue;
      }
      const scheduledReconnect = isScheduledReconnect(opportunity);
      const sentNudges = await countSentNudgesForOpportunity(opportunity.id);
      // Cap only applies to classic no-reply bumps — scheduled reconnects (manual or reply-parsed) always draft.
      if (!scheduledReconnect && sentNudges >= MAX_NUDGES_PER_OPPORTUNITY) {
        skipped.push({ opportunityId: opportunity.id, reason: `already sent ${sentNudges} nudges` });
        await updateOpportunityTouchTimestamps(opportunity.id, { nextFollowUpAt: null });
        continue;
      }

      const organization = await getOrganization(opportunity.organizationId);
      if (!organization) {
        skipped.push({ opportunityId: opportunity.id, reason: "organization missing" });
        continue;
      }

      const drafts = await listDraftsForOpportunity(opportunity.id);
      const prior = [...drafts].reverse().find((d) => d.status === "approved" || d.status === "approved_with_edits") ?? drafts[0];
      if (!prior?.contactId) {
        skipped.push({ opportunityId: opportunity.id, reason: "no prior draft/contact" });
        continue;
      }
      const contact = await getContact(prior.contactId);
      if (!contact?.email) {
        skipped.push({ opportunityId: opportunity.id, reason: "contact has no email" });
        continue;
      }

      const brief = await getLatestBriefForOpportunity(opportunity.id);
      const segmentId = await resolveIndustrySegmentIdForOrganization(organization);
      const feedback = await listRecentAcceptedEditFeedback({
        outreachPersona: contact.outreachPersona,
        industrySegmentId: segmentId,
        limit: 5,
      });
      const fewShots = formatFeedbackFewShots(feedback);
      const confidence = estimateDraftConfidence(feedback);

      const priorSubject = prior.editedSubject ?? prior.aiSubject;
      const priorBody = prior.editedBody ?? prior.aiBody;
      const firstName = (contact.fullName ?? "").trim().split(/\s+/)[0] || "there";

      const systemPrompt = scheduledReconnect
        ? `You write a short, warm 1:1 reconnect email for Crowdsource Choir sales. The prospect previously replied and asked (or you scheduled) to follow up later — that time has arrived. Match Joel's plain-spoken voice — no corporate filler, no guilt, no "just checking in." Reference that you're following up as discussed. 2–4 short paragraphs max. Include a clear soft ask to reconnect. Sign off as Joel DeJong. Do not invent facts about the prospect. ${fewShots}`
        : `You write a short, warm 1:1 follow-up email for Crowdsource Choir sales. Match Joel's plain-spoken voice — no corporate filler, no "just bumping this," no guilt. 2–4 short paragraphs max. Include a clear soft ask to reconnect. Sign off as Joel DeJong. Do not invent facts about the prospect. ${fewShots}`;

      const result = await callStructured({
        schema: NudgeDraftSchema,
        schemaName: "nudge_draft",
        systemPrompt,
        userContent: JSON.stringify({
          contactFirstName: firstName,
          organizationName: organization.name,
          opportunityTitle: opportunity.title,
          eventOrInitiativeName: opportunity.eventOrInitiativeName,
          brief,
          originalSubject: priorSubject,
          originalBody: priorBody,
          nudgeNumber: sentNudges + 1,
          kind: scheduledReconnect ? "scheduled_reconnect" : "no_reply_nudge",
          scheduledFollowUpAt: opportunity.nextFollowUpAt,
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
        metadata: {
          draftId: draft.id,
          nudgeNumber: sentNudges + 1,
          kind: scheduledReconnect ? "scheduled_reconnect" : "no_reply_nudge",
        },
        gmailThreadId: opportunity.gmailThreadId,
      });

      // Clear due date until this nudge is sent (or rejected); send path will set the next one.
      await updateOpportunityTouchTimestamps(opportunity.id, { nextFollowUpAt: null });
      created += 1;
    } catch (err) {
      errors.push(`${opportunity.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { considered: due.length, created, skipped, errors };
}
