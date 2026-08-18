import type { OutreachActivity } from "@/lib/sales/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Contacts whose last outbound is at least `dueAfterDays` old and who have not
 * replied since. Used to enqueue one-week no-response nudges.
 */
export function contactIdsDueForNudge(
  activities: Pick<OutreachActivity, "contactId" | "activityType" | "occurredAt">[],
  nowMs: number,
  dueAfterDays: number
): string[] {
  const byContact = new Map<string, { lastSent: number; lastReply: number }>();
  for (const activity of activities) {
    if (!activity.contactId) continue;
    const t = new Date(activity.occurredAt).getTime();
    if (Number.isNaN(t)) continue;
    const cur = byContact.get(activity.contactId) ?? { lastSent: 0, lastReply: 0 };
    if (activity.activityType === "sent") cur.lastSent = Math.max(cur.lastSent, t);
    if (activity.activityType === "replied") cur.lastReply = Math.max(cur.lastReply, t);
    byContact.set(activity.contactId, cur);
  }

  const dueMs = dueAfterDays * DAY_MS;
  const due: string[] = [];
  Array.from(byContact.entries()).forEach(([contactId, cur]) => {
    if (!cur.lastSent) return;
    if (cur.lastReply >= cur.lastSent) return;
    if (nowMs - cur.lastSent < dueMs) return;
    due.push(contactId);
  });
  return due;
}

/** Next reminder time for contacts who were sent mail but are not yet due. */
export function nextPendingFollowUpIso(
  activities: Pick<OutreachActivity, "contactId" | "activityType" | "occurredAt">[],
  nowMs: number,
  dueAfterDays: number
): string | null {
  const dueIds = new Set(contactIdsDueForNudge(activities, nowMs, dueAfterDays));
  const byContact = new Map<string, { lastSent: number; lastReply: number }>();
  for (const activity of activities) {
    if (!activity.contactId) continue;
    const t = new Date(activity.occurredAt).getTime();
    if (Number.isNaN(t)) continue;
    const cur = byContact.get(activity.contactId) ?? { lastSent: 0, lastReply: 0 };
    if (activity.activityType === "sent") cur.lastSent = Math.max(cur.lastSent, t);
    if (activity.activityType === "replied") cur.lastReply = Math.max(cur.lastReply, t);
    byContact.set(activity.contactId, cur);
  }
  let soonest: number | null = null;
  const dueMs = dueAfterDays * DAY_MS;
  Array.from(byContact.entries()).forEach(([contactId, cur]) => {
    if (!cur.lastSent) return;
    if (cur.lastReply >= cur.lastSent) return;
    if (dueIds.has(contactId)) return;
    const followUp = cur.lastSent + dueMs;
    if (followUp <= nowMs) return;
    if (soonest == null || followUp < soonest) soonest = followUp;
  });
  return soonest == null ? null : new Date(soonest).toISOString();
}

/** Keep the soonest follow-up; never push an existing reminder later. */
export function soonestFollowUpIso(existingIso: string | null | undefined, candidateIso: string): string {
  if (!existingIso) return candidateIso;
  const existing = new Date(existingIso).getTime();
  const candidate = new Date(candidateIso).getTime();
  if (Number.isNaN(existing)) return candidateIso;
  return candidate < existing ? candidateIso : existingIso;
}
