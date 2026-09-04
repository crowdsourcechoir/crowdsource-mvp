import { isFollowUpDueOnOrBeforeToday, isFollowUpOverdue } from "./calendar";

/** Today is for people who wrote back — not cold first-touch nudges. */
export function shouldShowTodayFollowUp(input: {
  hasLiveReply: boolean;
  nextFollowUpAt: string | null;
  now?: Date;
}): boolean {
  if (!input.hasLiveReply) return false;
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
