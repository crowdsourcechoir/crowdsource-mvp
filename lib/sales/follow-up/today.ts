import { isFollowUpDueOnOrBeforeToday, isFollowUpOverdue } from "./calendar";

/** Today is for people who wrote back and still need Joel's reply — not cold first-touch nudges. */
export function shouldShowTodayFollowUp(input: {
  hasLiveReply: boolean;
  inboundAfterSend: boolean;
  nextFollowUpAt: string | null;
  now?: Date;
}): boolean {
  if (!input.hasLiveReply) return false;
  // Joel already answered in Gmail (or the app) after their reply.
  if (!input.inboundAfterSend) return false;
  if (!input.nextFollowUpAt) return true;
  return isFollowUpDueOnOrBeforeToday(input.nextFollowUpAt, input.now);
}

export function todayFollowUpReason(input: {
  hasLiveReply: boolean;
  inboundAfterSend: boolean;
  nextFollowUpAt: string | null;
  now?: Date;
}): "overdue" | "replied" | "due" {
  if (input.hasLiveReply && input.inboundAfterSend) {
    if (isFollowUpOverdue(input.nextFollowUpAt, input.now)) return "overdue";
    return "replied";
  }
  if (isFollowUpOverdue(input.nextFollowUpAt, input.now)) return "overdue";
  return "due";
}
