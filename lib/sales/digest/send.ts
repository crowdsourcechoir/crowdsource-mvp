import { Resend } from "resend";
import {
  listQueueItems,
  listQueueItemsCreatedSince,
  listPendingNeverDigestedQueueItems,
  markQueueItemsDigested,
  countPendingQueueItems,
} from "../db/queue";
import { assembleQueueItemDetail } from "../db/assemble";
import { createDigestRun, finishDigestRun, getLastDeliveredDigestRun, getLastSucceededDigestRun } from "../db/digestRuns";
import { renderDigestEmail } from "./render";
import { getDigestAlreadySentWindowMs, getDigestMinScore, getDigestTargetCount } from "./config";
import { filterDigestQualifyingItems, sortByScoreDesc } from "./qualify";
import { siteUrl } from "@/lib/site-url";
import type { ApprovalQueueItem, QueueItemDetail } from "../types";

export type DigestSendResult = {
  status: "succeeded" | "failed" | "skipped_no_provider";
  itemCount: number;
  minScore: number;
  error?: string;
};

const DEFAULT_FALLBACK_LOOKBACK_HOURS = 24;
const DEFAULT_FROM = "Crowdsource Sales <onboarding@resend.dev>";

async function assembleMany(queueItems: ApprovalQueueItem[]): Promise<QueueItemDetail[]> {
  return (await Promise.all(queueItems.map((qi) => assembleQueueItemDetail(qi.opportunityId)))).filter(
    (d): d is QueueItemDetail => d !== null
  );
}

/**
 * Loads pending queue items that clear the digest min-score bar.
 *
 * Preference order:
 * 1. Pending 70+ never included in a prior digest (`last_digested_at` null) — survives force-sends
 * 2. Else brand-new since last delivered digest, with overdue backfill from older pending 70+
 *
 * Overdue backfill: if under target and the last delivered digest is older than the already-sent
 * window (or the last succeeded send was empty), top up from older pending 70+ so a discovery
 * stall cannot silence the inbox for days.
 */
export async function loadQualifyingDigestItems(minScore = getDigestMinScore()): Promise<{
  items: QueueItemDetail[];
  sinceIso: string;
  backlogCount: number;
  backfilled: boolean;
}> {
  const [lastDelivered, lastSucceeded] = await Promise.all([getLastDeliveredDigestRun(), getLastSucceededDigestRun()]);
  const sinceIso =
    lastDelivered?.finishedAt ?? new Date(Date.now() - DEFAULT_FALLBACK_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const targetCount = getDigestTargetCount();
  const alreadySentWindowMs = getDigestAlreadySentWindowMs();
  const backlogCount = await countPendingQueueItems();

  // Prefer never-digested pending when the tracking column exists.
  const neverDigested = await listPendingNeverDigestedQueueItems();
  if (neverDigested) {
    const undigested = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(neverDigested), minScore));
    if (undigested.length >= targetCount) {
      return { items: undigested, sinceIso, backlogCount, backfilled: false };
    }
    // Under target: still return what we have (ensureDigestTarget will top up discovery/pipeline).
    // Also allow overdue backfill from already-digested-but-still-pending only when due.
    const lastDeliveredAgeMs = lastDelivered?.finishedAt
      ? Date.now() - Date.parse(lastDelivered.finishedAt)
      : Number.POSITIVE_INFINITY;
    const dueForMorningSend = lastDeliveredAgeMs >= alreadySentWindowMs;
    if (undigested.length < targetCount && dueForMorningSend) {
      const allPending = await listQueueItems("pending");
      const older = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(allPending), minScore));
      const seen = new Set(undigested.map((i) => i.queueItem.id));
      const merged = [...undigested];
      for (const item of older) {
        if (seen.has(item.queueItem.id)) continue;
        seen.add(item.queueItem.id);
        merged.push(item);
        if (merged.length >= targetCount) break;
      }
      return {
        items: merged,
        sinceIso,
        backlogCount,
        backfilled: merged.length > undigested.length,
      };
    }
    return { items: undigested, sinceIso, backlogCount, backfilled: false };
  }

  // Fallback when last_digested_at isn't migrated yet.
  const [newQueueItems] = await Promise.all([listQueueItemsCreatedSince(sinceIso)]);
  const newItems = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(newQueueItems), minScore));
  let items = newItems;
  let backfilled = false;

  const lastDeliveredAgeMs = lastDelivered?.finishedAt
    ? Date.now() - Date.parse(lastDelivered.finishedAt)
    : Number.POSITIVE_INFINITY;
  const dueForMorningSend = lastDeliveredAgeMs >= alreadySentWindowMs;
  const lastSendWasEmpty = !lastSucceeded || lastSucceeded.itemCount === 0;
  const shouldBackfill = items.length < targetCount && (lastSendWasEmpty || dueForMorningSend);

  if (shouldBackfill) {
    const allPending = await listQueueItems("pending");
    const older = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(allPending), minScore));
    const seen = new Set(items.map((i) => i.queueItem.id));
    const merged = [...items];
    for (const item of older) {
      if (seen.has(item.queueItem.id)) continue;
      seen.add(item.queueItem.id);
      merged.push(item);
      if (merged.length >= targetCount) break;
    }
    items = merged;
    const newIds = new Set(newItems.map((i) => i.queueItem.id));
    backfilled = items.some((i) => !newIds.has(i.queueItem.id));
  }

  return { items, sinceIso, backlogCount, backfilled };
}

/** All pending queue items at/above the digest min score — used for force-resend with corrected links. */
export async function loadAllPendingDigestItems(minScore = getDigestMinScore()): Promise<{
  items: QueueItemDetail[];
  sinceIso: string;
  backlogCount: number;
}> {
  const [allPending, backlogCount, lastDelivered] = await Promise.all([
    listQueueItems("pending"),
    countPendingQueueItems(),
    getLastDeliveredDigestRun(),
  ]);
  const sinceIso =
    lastDelivered?.finishedAt ?? new Date(Date.now() - DEFAULT_FALLBACK_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const items = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(allPending), minScore));
  return { items, sinceIso, backlogCount };
}

/** Canonical morning-digest inbox. */
export const DEFAULT_DIGEST_TO_EMAIL = "sing@crowdsourcechoir.com";

/**
 * Resolve digest recipient. Prefer an explicit per-send override, otherwise the
 * Crowdsource ops inbox. `SALES_DIGEST_TO_EMAIL` overrides when set (for staging);
 * the retired crowdsourcechoir@gmail.com value is ignored so stale Vercel env cannot
 * keep routing mail away from sing@.
 */
function resolveDigestToEmail(override?: string): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromEnv = process.env.SALES_DIGEST_TO_EMAIL?.trim();
  if (fromEnv && fromEnv.toLowerCase() !== "crowdsourcechoir@gmail.com") return fromEnv;
  return DEFAULT_DIGEST_TO_EMAIL;
}

/**
 * Sends the "new leads since last digest" email — the actual "in my inbox every morning" piece.
 * A no-op (recorded as `skipped_no_provider`, never an error) if RESEND_API_KEY isn't set,
 * same graceful-degradation contract as discovery/enrichment (see docs/sales-platform/roadmap.md).
 * Recipient is sing@crowdsourcechoir.com (override via options.to or SALES_DIGEST_TO_EMAIL).
 *
 * Only includes leads scoring >= SALES_DIGEST_MIN_SCORE (default 70). Cron callers should use
 * `ensureDigestTarget` so the email waits until SALES_DIGEST_TARGET_COUNT (default 10) qualify;
 * manual/admin sends still go out with whatever currently qualifies (including zero) for testing.
 */
export async function sendDailyDigest(
  trigger: "manual" | "cron" = "cron",
  options?: {
    items?: QueueItemDetail[];
    sinceIso?: string;
    backlogCount?: number;
    minScore?: number;
    to?: string;
  }
): Promise<DigestSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = resolveDigestToEmail(options?.to);
  const minScore = options?.minScore ?? getDigestMinScore();
  if (!apiKey) {
    return { status: "skipped_no_provider", itemCount: 0, minScore };
  }

  const digestRun = await createDigestRun(trigger);

  try {
    const loaded =
      options?.items && options.sinceIso !== undefined && options.backlogCount !== undefined
        ? { items: options.items, sinceIso: options.sinceIso, backlogCount: options.backlogCount }
        : await loadQualifyingDigestItems(minScore);

    const { subject, html, text } = renderDigestEmail(
      loaded.items,
      { newCount: loaded.items.length, backlogCount: loaded.backlogCount, sinceIso: loaded.sinceIso, minScore },
      siteUrl()
    );

    const resend = new Resend(apiKey);
    const from = process.env.SALES_DIGEST_FROM_EMAIL || DEFAULT_FROM;
    const { data, error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(typeof error === "string" ? error : error.message);

    await finishDigestRun(digestRun.id, {
      status: "succeeded",
      itemCount: loaded.items.length,
      recipient: to,
      providerMessageId: data?.id ?? null,
    });
    await markQueueItemsDigested(loaded.items.map((i) => i.queueItem.id));
    return { status: "succeeded", itemCount: loaded.items.length, minScore };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await finishDigestRun(digestRun.id, { status: "failed", recipient: to, error: message });
    return { status: "failed", itemCount: 0, minScore, error: message };
  }
}
