import type { RelationshipStage } from "@/lib/sales/types";
import { contactGreetingName } from "@/lib/sales/dedupe";
import { latestLiveCorrespondent } from "@/lib/sales/outreach/reply-correspondent";
import { siteUrl } from "@/lib/site-url";

/** Stored on opportunities.import_metadata. Active deals in the pipeline do not have this. */
export const PARKED_FOLLOW_UP_KEY = "parkedFollowUp";

export type ParkedFollowUpRecord = {
  active: true;
  followUpOn: string;
  previousStage: RelationshipStage | null;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  draftId: string;
  subject: string;
  body: string;
  editionLabel: string;
  calendarDescription: string;
  parkedAt: string;
};

export type CheckInDraft = {
  subject: string;
  body: string;
  editionLabel: string;
  year: number;
  declinedThisEdition: boolean;
};

const ACTIVE_STAGES = new Set<RelationshipStage>(["awareness", "interest", "purchase"]);

export function isParkedOpportunity(input: {
  relationshipStage?: string | null;
  importMetadata?: Record<string, unknown> | null;
}): boolean {
  if (input.relationshipStage === "parked") return true;
  return readParkedFollowUp(input.importMetadata) != null;
}

export function readParkedFollowUp(metadata: Record<string, unknown> | null | undefined): ParkedFollowUpRecord | null {
  const raw = metadata?.[PARKED_FOLLOW_UP_KEY];
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.active !== true) return null;
  if (typeof row.followUpOn !== "string" || typeof row.draftId !== "string") return null;
  if (typeof row.subject !== "string" || typeof row.body !== "string") return null;
  if (typeof row.editionLabel !== "string" || typeof row.contactId !== "string") return null;
  const previous = row.previousStage;
  return {
    active: true,
    followUpOn: row.followUpOn,
    previousStage:
      previous === "awareness" || previous === "interest" || previous === "purchase" || previous === "lost" || previous === "parked"
        ? previous
        : null,
    contactId: row.contactId,
    contactName: typeof row.contactName === "string" ? row.contactName : null,
    contactEmail: typeof row.contactEmail === "string" ? row.contactEmail : null,
    draftId: row.draftId,
    subject: row.subject,
    body: row.body,
    editionLabel: row.editionLabel,
    calendarDescription: typeof row.calendarDescription === "string" ? row.calendarDescription : row.body,
    parkedAt: typeof row.parkedAt === "string" ? row.parkedAt : new Date(0).toISOString(),
  };
}

export function withParkedFollowUp(
  metadata: Record<string, unknown> | null | undefined,
  record: ParkedFollowUpRecord,
  calendarEventId: string | null
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [PARKED_FOLLOW_UP_KEY]: record,
    followUpCalendarEventId: calendarEventId,
  };
}

export function withoutParkedFollowUp(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  delete next[PARKED_FOLLOW_UP_KEY];
  delete next.followUpCalendarEventId;
  return next;
}

export function stageAfterUnpark(previous: RelationshipStage | null | undefined): RelationshipStage {
  if (previous && ACTIVE_STAGES.has(previous)) return previous;
  return "interest";
}

export function editionBaseName(eventName: string | null | undefined, organizationName: string): string {
  const raw = (eventName?.trim() || organizationName.trim()).replace(/\s+20\d{2}\b/g, " ");
  const cleaned = raw.replace(/\s+/g, " ").trim();
  return cleaned || organizationName.trim() || "this gathering";
}

export function nextEditionYear(eventDateEstimate: string | null | undefined, eventName: string | null | undefined): number | null {
  const fromDate = /^(\d{4})/.exec(eventDateEstimate?.trim() ?? "");
  if (fromDate) return Number(fromDate[1]) + 1;
  const fromName = /\b(20\d{2})\b/.exec(eventName ?? "");
  if (fromName) return Number(fromName[1]) + 1;
  return null;
}

export function replyDeclinedThisEdition(snippet: string | null | undefined): boolean {
  if (!snippet?.trim()) return false;
  return /cost|budget|price|pricing|this year|cannot commit|can't commit|not moving forward|decided that we cannot/i.test(
    snippet
  );
}

export function buildCheckInDraft(input: {
  firstName: string;
  organizationName: string;
  eventName?: string | null;
  eventDateEstimate?: string | null;
  replySnippet?: string | null;
}): CheckInDraft {
  const base = editionBaseName(input.eventName, input.organizationName);
  const year = nextEditionYear(input.eventDateEstimate, input.eventName ?? input.organizationName);
  const editionLabel = year ? `${base} ${year}` : base;
  const greeting = input.firstName.trim() || "there";
  const declined = replyDeclinedThisEdition(input.replySnippet);
  const body = declined
    ? [
        `Hi ${greeting},`,
        "",
        "Thank you again for the conversation, and for being straight with me about this year. The offering landed, and the cost didn't fit. I appreciate you saying so.",
        "",
        `I'd like to check in on the ${editionLabel}. If you're starting to shape that gathering, I want to know whether a participatory anthem still feels like a fit, and what the planning window looks like on your side.`,
        "",
        "No need to reopen this year's decision. I'm keeping the door open for next year, and I'll follow your lead.",
        "",
        "Best,",
        "Joel",
      ].join("\n")
    : [
        `Hi ${greeting},`,
        "",
        `I've been thinking about our conversation, and about ${base}. I'd like to check in on the ${editionLabel} while there's still time to shape it.`,
        "",
        "If a participatory anthem still feels like a fit, I'd love to hear what the planning window looks like on your side. If the timing has moved on, just tell me and I'll leave it.",
        "",
        "Best,",
        "Joel",
      ].join("\n");
  return {
    subject: editionLabel,
    body,
    editionLabel,
    year: year ?? new Date().getFullYear() + 1,
    declinedThisEdition: declined,
  };
}

export function checkInEventSummary(editionLabel: string): string {
  return `Check in — ${editionLabel}`;
}

export function checkInCalendarDescription(input: {
  opportunityId: string;
  contactName: string | null;
  contactEmail: string | null;
  editionLabel: string;
  subject: string;
  body: string;
}): string {
  const who = [input.contactName, input.contactEmail].filter(Boolean).join(" · ");
  const link = `${siteUrl()}/admin/sales/opportunities/${input.opportunityId}`;
  return [
    "Reminder only. This does not send email.",
    "",
    who ? `Check in with ${who} about ${input.editionLabel}.` : `Check in about ${input.editionLabel}.`,
    `Open the deal: ${link}`,
    "",
    `Subject: ${input.subject}`,
    "",
    input.body,
  ].join("\n");
}

export function pickCheckInContact<T extends { id: string; fullName: string | null; email: string | null }>(
  contacts: T[],
  activities: Array<{
    activityType: string;
    occurredAt: string;
    contactId: string | null;
    metadata: Record<string, unknown> | null;
  }>
): T | null {
  const withEmail = contacts.filter((contact) => contact.email?.trim());
  const correspondent = latestLiveCorrespondent(activities, withEmail);
  if (correspondent) {
    const match = withEmail.find((contact) => contact.id === correspondent.contactId);
    if (match) return match;
  }
  const sent = activities
    .filter((activity) => activity.activityType === "sent" && activity.contactId)
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  for (const activity of sent) {
    const match = withEmail.find((contact) => contact.id === activity.contactId);
    if (match) return match;
  }
  return withEmail[0] ?? null;
}

export function greetingForContact(contact: { fullName: string | null; email: string | null } | null): string {
  return contactGreetingName(contact);
}

export function isRelationshipStageConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /relationship_stage/i.test(message) && /check constraint|violates check/i.test(message);
}
