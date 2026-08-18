import type { OutreachDraft } from "@/lib/sales/types";

/** Operator recorded an email that already went out in Gmail (or another client). */
export const EXTERNAL_SENT_SUBJECT = "Sent from Gmail";
export const EXTERNAL_SENT_BODY =
  "Recorded as already emailed outside this app. This is not a sendable draft.";

export function placeholderSentDraft(input: {
  opportunityId: string;
  contactId: string;
  nowIso?: string;
}): OutreachDraft {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    id: `local-sent-${input.contactId}`,
    opportunityId: input.opportunityId,
    contactId: input.contactId,
    pipelineRunId: null,
    templateId: null,
    kind: "initial",
    aiSubject: EXTERNAL_SENT_SUBJECT,
    aiBody: EXTERNAL_SENT_BODY,
    editedSubject: null,
    editedBody: null,
    qaFlags: null,
    status: "approved",
    confidenceScore: null,
    createdAt: now,
    updatedAt: now,
  };
}
