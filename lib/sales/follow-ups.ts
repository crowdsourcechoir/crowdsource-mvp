import { addDaysIso } from "./gmail/constants";

export type FollowUpRow = {
  queueItemId: string | null;
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  lastOutboundAt: string | null;
  daysSinceSend: number | null;
  nextFollowUpAt: string | null;
  subject: string;
  body: string;
  hasDraft: boolean;
  relationshipStage: string | null;
};

export function daysSinceIso(iso: string | null, nowMs: number = Date.now()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((nowMs - then) / (1000 * 60 * 60 * 24)));
}

/** Follow-ups snooze: bump next_follow_up_at by `days` (default 7). */
export function snoozeUntilIso(from: Date = new Date(), days = 7): string {
  return addDaysIso(from.toISOString(), days);
}

export function isFirstTouchQueueKind(kind: string | null | undefined): boolean {
  return (kind ?? "initial") !== "nudge";
}
