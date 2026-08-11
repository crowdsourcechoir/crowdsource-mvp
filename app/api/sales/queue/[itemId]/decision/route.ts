import { NextResponse } from "next/server";
import { decideQueueItem, getQueueItem } from "@/lib/sales/db/queue";
import { updateDraftDecision, getDraft } from "@/lib/sales/db/outreach";
import {
  getOpportunity,
  updateOpportunityStatus,
  updateOpportunityRelationshipStage,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { getContact } from "@/lib/sales/db/contacts";
import { getOrganization } from "@/lib/sales/db/organizations";
import { resolveIndustrySegmentIdForOrganization } from "@/lib/sales/db/lookups";
import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { createOutreachFeedback } from "@/lib/sales/db/feedback";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { sendGmailMessage, getGmailRfcMessageId } from "@/lib/sales/gmail/send";
import { addDaysIso, NUDGE_DUE_AFTER_DAYS } from "@/lib/sales/gmail/constants";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import type { ApprovalQueueItemStatus, OpportunityStatus } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

const ACTION_TO_QUEUE_STATUS: Record<string, ApprovalQueueItemStatus> = {
  approve: "approved",
  approve_with_edits: "approved_with_edits",
  reject: "rejected",
  defer: "deferred",
  request_more_research: "needs_more_research",
  mark_duplicate: "duplicate",
};

const QUEUE_STATUS_TO_OPPORTUNITY_STATUS: Record<ApprovalQueueItemStatus, OpportunityStatus> = {
  pending: "ready_for_review",
  approved: "approved",
  approved_with_edits: "approved",
  rejected: "rejected",
  deferred: "deferred",
  needs_more_research: "needs_more_research",
  duplicate: "duplicate",
};

function normalizeEmailText(value: string): string {
  return stripEmailSignature(value).replace(/\r\n/g, "\n").trim();
}

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const action = body?.action as string;
    const queueStatus = ACTION_TO_QUEUE_STATUS[action];
    if (!queueStatus) {
      return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
    }

    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.status !== "pending") {
      return NextResponse.json({ error: "Queue item already decided." }, { status: 409 });
    }

    const draft = item.outreachDraftId ? await getDraft(item.outreachDraftId) : null;
    const opportunity = await getOpportunity(item.opportunityId);
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    const providedEditedSubject =
      typeof body?.editedSubject === "string" ? (body.editedSubject as string) : undefined;
    const providedEditedBody = typeof body?.editedBody === "string" ? (body.editedBody as string) : undefined;

    const isApproveAction = action === "approve" || action === "approve_with_edits";
    const finalSubject =
      providedEditedSubject ?? draft?.editedSubject ?? draft?.aiSubject ?? null;
    const finalBody = providedEditedBody ?? draft?.editedBody ?? draft?.aiBody ?? null;

    // Learn from whatever was actually sent vs the AI original — including Save draft then
    // plain "Approve & send", which used to skip feedback because the client thought nothing changed.
    const contentDiffersFromAi = Boolean(
      draft &&
        finalSubject !== null &&
        finalBody !== null &&
        (normalizeEmailText(finalSubject) !== normalizeEmailText(draft.aiSubject) ||
          normalizeEmailText(finalBody) !== normalizeEmailText(draft.aiBody))
    );

    const effectiveAction =
      isApproveAction && contentDiffersFromAi ? "approve_with_edits" : action;
    const effectiveQueueStatus = ACTION_TO_QUEUE_STATUS[effectiveAction] ?? queueStatus;
    const isApprove = effectiveAction === "approve" || effectiveAction === "approve_with_edits";

    let gmailSend: { messageId: string; threadId: string } | null = null;
    let gmailStatus = await getGmailConnectionStatus();

    // Fail-closed: if Gmail is connected, send before marking approved. If not connected, approve
    // without send (clipboard/mailto fallback on the client).
    if (isApprove && draft && finalSubject && finalBody) {
      const contact = draft.contactId ? await getContact(draft.contactId) : null;
      if (!contact?.email) {
        return NextResponse.json({ error: "Cannot approve — draft has no contact email." }, { status: 400 });
      }

      if (gmailStatus.connected) {
        try {
          let inReplyTo: string | null = null;
          let threadId = opportunity.gmailThreadId;
          if (item.kind === "nudge" && threadId) {
            const activities = await listActivitiesForOpportunity(opportunity.id);
            const lastSent = [...activities].reverse().find((a) => a.activityType === "sent" && a.gmailMessageId);
            if (lastSent?.gmailMessageId) {
              inReplyTo = await getGmailRfcMessageId(lastSent.gmailMessageId);
            }
          }
          gmailSend = await sendGmailMessage({
            to: contact.email,
            subject: finalSubject,
            body: finalBody,
            threadId: item.kind === "nudge" ? threadId : null,
            inReplyTo,
            references: inReplyTo,
          });
        } catch (err) {
          return NextResponse.json(
            {
              error: `Gmail send failed — draft was NOT approved. ${err instanceof Error ? err.message : String(err)}`,
              gmailConnected: true,
            },
            { status: 502 }
          );
        }
      }
    }

    const updated = await decideQueueItem(itemId, {
      status: effectiveQueueStatus,
      decisionNotes: body?.notes ?? null,
      decidedBy: body?.decidedBy ?? "operator",
      deferredUntil: body?.deferredUntil ?? undefined,
    });

    // Nudge decisions shouldn't bounce the opportunity out of the funnel / change pipeline status
    // back to rejected etc. in surprising ways — only initial items drive opportunity.status.
    if (item.kind === "initial") {
      await updateOpportunityStatus(item.opportunityId, QUEUE_STATUS_TO_OPPORTUNITY_STATUS[effectiveQueueStatus]);
    }

    if (isApprove) {
      if (item.kind === "initial" || !opportunity.relationshipStage) {
        await updateOpportunityRelationshipStage(item.opportunityId, "awareness");
      }

      await createOutreachActivity({
        opportunityId: item.opportunityId,
        contactId: draft?.contactId ?? null,
        activityType: "approved",
        metadata: { queueItemId: item.id, kind: item.kind, viaGmail: Boolean(gmailSend) },
        gmailThreadId: gmailSend?.threadId ?? opportunity.gmailThreadId,
      });

      if (gmailSend) {
        const now = new Date().toISOString();
        await createOutreachActivity({
          opportunityId: item.opportunityId,
          contactId: draft?.contactId ?? null,
          activityType: "sent",
          occurredAt: now,
          metadata: { kind: item.kind, queueItemId: item.id },
          gmailMessageId: gmailSend.messageId,
          gmailThreadId: gmailSend.threadId,
        });
        await updateOpportunityTouchTimestamps(item.opportunityId, {
          lastOutboundAt: now,
          nextFollowUpAt: addDaysIso(now, NUDGE_DUE_AFTER_DAYS),
          gmailThreadId: gmailSend.threadId,
        });
      }
    }

    if (draft && isApprove) {
      await updateDraftDecision(draft.id, {
        status: contentDiffersFromAi ? "approved_with_edits" : "approved",
        editedSubject: contentDiffersFromAi ? finalSubject : undefined,
        editedBody: contentDiffersFromAi ? finalBody : undefined,
      });
    } else if (draft && effectiveAction === "reject") {
      await updateDraftDecision(draft.id, { status: "rejected" });
    }

    // Learning loop: persist edits / rejections for future draft few-shots.
    let learned = false;
    let learningError: string | null = null;
    if (draft && (contentDiffersFromAi || effectiveAction === "reject")) {
      try {
        const organization = await getOrganization(opportunity.organizationId);
        const contact = draft.contactId ? await getContact(draft.contactId) : null;
        const segmentId = organization ? await resolveIndustrySegmentIdForOrganization(organization) : null;
        await createOutreachFeedback({
          opportunityId: opportunity.id,
          outreachDraftId: draft.id,
          contactId: draft.contactId,
          opportunityTypeId: opportunity.opportunityTypeId,
          industrySegmentId: segmentId,
          outreachPersona: contact?.outreachPersona ?? null,
          decision: effectiveAction === "reject" ? "rejected" : "approved_with_edits",
          originalSubject: draft.aiSubject,
          originalBody: draft.aiBody,
          editedSubject: contentDiffersFromAi ? finalSubject : null,
          editedBody: contentDiffersFromAi ? finalBody : null,
          rejectionReason: effectiveAction === "reject" ? (body?.notes as string | null) ?? null : null,
        });
        learned = contentDiffersFromAi || effectiveAction === "reject";
      } catch (err) {
        learningError = err instanceof Error ? err.message : "Failed to store learning feedback";
      }
    }

    gmailStatus = await getGmailConnectionStatus();
    return NextResponse.json({
      queueItem: updated,
      learned: Boolean(contentDiffersFromAi && learned && !learningError),
      learningError,
      gmail: {
        connected: gmailStatus.connected,
        email: gmailStatus.email,
        sent: Boolean(gmailSend),
        messageId: gmailSend?.messageId ?? null,
        threadId: gmailSend?.threadId ?? null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
