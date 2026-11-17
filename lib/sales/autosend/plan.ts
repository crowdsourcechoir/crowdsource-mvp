import {
  AUTO_SEND_DAILY_CAP,
  addDaysYmd,
  bandRank,
  eventDateBand,
  openSlotTimes,
  pacificClock,
  upcomingBusinessDays,
} from "./policy";
import type { AutoSendCandidate, AutoSendSlot } from "./types";

const STUCK_SENDING_MS = 10 * 60 * 1000;
const HISTORY_DAYS = 14;

function compareCandidates(a: AutoSendCandidate, b: AutoSendCandidate, todayYmd: string): number {
  const band =
    bandRank(eventDateBand(a.eventDate, todayYmd)) - bandRank(eventDateBand(b.eventDate, todayYmd));
  if (band !== 0) return band;
  if (b.score !== a.score) return b.score - a.score;
  return a.eventDate.localeCompare(b.eventDate);
}

function slotFromCandidate(candidate: AutoSendCandidate, day: string, scheduledAt: string): AutoSendSlot {
  return {
    queueItemId: candidate.queueItemId,
    opportunityId: candidate.opportunityId,
    organizationId: candidate.organizationId,
    organizationName: candidate.organizationName,
    contactName: candidate.contactName,
    contactEmail: candidate.contactEmail,
    subject: candidate.subject,
    eventTitle: candidate.eventTitle,
    eventDate: candidate.eventDate,
    score: candidate.score,
    day,
    scheduledAt,
    status: "queued",
    statusSince: null,
    sentAt: null,
    error: null,
    attempts: 0,
  };
}

function refreshQueued(slot: AutoSendSlot, candidate: AutoSendCandidate): AutoSendSlot {
  return {
    ...slot,
    organizationName: candidate.organizationName,
    contactName: candidate.contactName,
    contactEmail: candidate.contactEmail,
    subject: candidate.subject,
    eventTitle: candidate.eventTitle,
    eventDate: candidate.eventDate,
    score: candidate.score,
  };
}

/**
 * Keep finished sends, keep future queued rows that are still eligible, and fill each
 * open business day up to 25. Q1–Q2 2027 is used before Q3, then the rolling window.
 */
export function mergeAutoSendSlots(
  existing: AutoSendSlot[],
  candidates: AutoSendCandidate[],
  now: Date
): AutoSendSlot[] {
  const today = pacificClock(now).ymd;
  const days = upcomingBusinessDays(now, 5);
  const daySet = new Set(days);
  const historyFloor = addDaysYmd(today, -HISTORY_DAYS);
  const byItem = new Map(candidates.map((candidate) => [candidate.queueItemId, candidate]));

  const kept: AutoSendSlot[] = [];
  for (const slot of existing) {
    if (slot.status === "sent" || slot.status === "failed" || slot.status === "skipped") {
      if (slot.day >= historyFloor) kept.push(slot);
      continue;
    }
    if (slot.status === "sending") {
      const since = Date.parse(slot.statusSince ?? slot.scheduledAt);
      if (Number.isFinite(since) && now.getTime() - since > STUCK_SENDING_MS) {
        const candidate = byItem.get(slot.queueItemId);
        if (candidate && daySet.has(slot.day)) {
          kept.push(refreshQueued({ ...slot, status: "queued", error: "Send was interrupted and returned to the line." }, candidate));
        }
      } else if (daySet.has(slot.day)) {
        kept.push(slot);
      }
      continue;
    }
    if (slot.status === "queued" && daySet.has(slot.day) && Date.parse(slot.scheduledAt) >= now.getTime() - 25 * 60 * 1000) {
      const candidate = byItem.get(slot.queueItemId);
      if (candidate) kept.push(refreshQueued(slot, candidate));
    }
  }

  const usedItems = new Set(kept.map((slot) => slot.queueItemId));
  const usedOrgs = new Set(kept.map((slot) => slot.organizationId));
  const pool = candidates
    .filter((candidate) => !usedItems.has(candidate.queueItemId) && !usedOrgs.has(candidate.organizationId))
    .sort((a, b) => compareCandidates(a, b, today));

  const seenOrgs = new Set(usedOrgs);
  const uniquePool: AutoSendCandidate[] = [];
  for (const candidate of pool) {
    if (seenOrgs.has(candidate.organizationId)) continue;
    seenOrgs.add(candidate.organizationId);
    uniquePool.push(candidate);
  }

  const next = [...kept];
  let cursor = 0;
  for (const day of days) {
    const onDay = next.filter(
      (slot) => slot.day === day && (slot.status === "queued" || slot.status === "sending" || slot.status === "sent")
    );
    const need = AUTO_SEND_DAILY_CAP - onDay.length;
    if (need <= 0 || cursor >= uniquePool.length) continue;
    const times = openSlotTimes(
      day,
      now,
      onDay.map((slot) => slot.scheduledAt),
      Math.min(need, uniquePool.length - cursor)
    );
    for (const scheduledAt of times) {
      const candidate = uniquePool[cursor];
      if (!candidate) break;
      cursor += 1;
      next.push(slotFromCandidate(candidate, day, scheduledAt));
    }
  }

  return next.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.organizationName.localeCompare(b.organizationName));
}
