import { normalizeEmail } from "@/lib/sales/dedupe";
import {
  AUTO_SEND_DAILY_CAP,
  AUTO_SEND_LANES,
  LANE_DAILY_QUOTA,
  addDaysYmd,
  bandRank,
  eventDateBand,
  openSlotTimes,
  pacificClock,
  upcomingBusinessDays,
  type AutoSendLane,
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
    lane: candidate.lane,
    day,
    scheduledAt,
    status: "queued",
    statusSince: null,
    sentAt: null,
    draftUrl: null,
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
    lane: candidate.lane,
  };
}

function nextLane(used: Record<AutoSendLane, number>, pools: Record<AutoSendLane, AutoSendCandidate[]>): AutoSendLane | null {
  const order: AutoSendLane[] = ["large", "partnership", "sponsorship", "other"];
  let best: AutoSendLane | null = null;
  let bestRatio = Infinity;
  let bestOrder = Infinity;
  for (const lane of AUTO_SEND_LANES) {
    if (used[lane] >= LANE_DAILY_QUOTA[lane] || pools[lane].length === 0) continue;
    const ratio = used[lane] / LANE_DAILY_QUOTA[lane];
    const laneOrder = order.indexOf(lane);
    if (ratio < bestRatio || (ratio === bestRatio && laneOrder < bestOrder)) {
      best = lane;
      bestRatio = ratio;
      bestOrder = laneOrder;
    }
  }
  return best;
}

/**
 * Keep finished sends and created drafts. Rebuild the open line so each day follows the lane quotas:
 * 18 large ($15k+), 2 sponsorship, 3 partnership, 2 other. A short lane is left short.
 * Inside a lane, Q1–Q2 2027 is used before Q3, then the rolling window.
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
    if (slot.status === "sent" || slot.status === "drafted" || slot.status === "failed" || slot.status === "skipped") {
      if (slot.day >= historyFloor) kept.push(slot);
      continue;
    }
    if (slot.status === "sending") {
      const since = Date.parse(slot.statusSince ?? slot.scheduledAt);
      if (Number.isFinite(since) && now.getTime() - since > STUCK_SENDING_MS) {
        const candidate = byItem.get(slot.queueItemId);
        if (candidate && daySet.has(slot.day)) {
          kept.push(refreshQueued({ ...slot, status: "queued", error: "Draft was interrupted and returned to the line." }, candidate));
        }
      } else if (daySet.has(slot.day)) {
        kept.push(slot);
      }
      continue;
    }
  }

  const usedItems = new Set(kept.map((slot) => slot.queueItemId));
  const usedOrgs = new Set(kept.map((slot) => slot.organizationId));
  const usedEmails = new Set(
    kept.map((slot) => normalizeEmail(slot.contactEmail)).filter((email): email is string => Boolean(email))
  );
  const pool = candidates
    .filter((candidate) => {
      const email = normalizeEmail(candidate.contactEmail);
      if (usedItems.has(candidate.queueItemId) || usedOrgs.has(candidate.organizationId)) return false;
      if (email && usedEmails.has(email)) return false;
      return true;
    })
    .sort((a, b) => compareCandidates(a, b, today));

  const seenOrgs = new Set(usedOrgs);
  const seenEmails = new Set(usedEmails);
  const uniquePool: AutoSendCandidate[] = [];
  for (const candidate of pool) {
    const email = normalizeEmail(candidate.contactEmail);
    if (seenOrgs.has(candidate.organizationId)) continue;
    if (email && seenEmails.has(email)) continue;
    seenOrgs.add(candidate.organizationId);
    if (email) seenEmails.add(email);
    uniquePool.push(candidate);
  }

  const pools: Record<AutoSendLane, AutoSendCandidate[]> = {
    large: [],
    sponsorship: [],
    partnership: [],
    other: [],
  };
  for (const candidate of uniquePool) pools[candidate.lane].push(candidate);

  const next = [...kept];
  for (const day of days) {
    const onDay = next.filter(
      (slot) =>
        slot.day === day &&
        (slot.status === "queued" || slot.status === "sending" || slot.status === "sent" || slot.status === "drafted")
    );
    const seats = AUTO_SEND_DAILY_CAP - onDay.length;
    if (seats <= 0) continue;
    const used: Record<AutoSendLane, number> = { large: 0, sponsorship: 0, partnership: 0, other: 0 };
    for (const slot of onDay) used[slot.lane] += 1;

    const picks: AutoSendCandidate[] = [];
    while (picks.length < seats) {
      const lane = nextLane(used, pools);
      const candidate = lane ? pools[lane].shift() : undefined;
      if (!lane || !candidate) break;
      used[lane] += 1;
      picks.push(candidate);
    }
    const times = openSlotTimes(
      day,
      now,
      onDay.map((slot) => slot.scheduledAt),
      picks.length
    );
    picks.forEach((candidate, index) => {
      const scheduledAt = times[index];
      if (!scheduledAt) return;
      next.push(slotFromCandidate(candidate, day, scheduledAt));
    });
  }

  return next.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.organizationName.localeCompare(b.organizationName));
}
