import { listQueueItems, listQueueItemsCreatedSince, countPendingQueueItems, scoresByQueueItemId } from "../db/queue";
import { assembleQueueItemDetailFromQueueItem } from "../db/assemble";
import { createDigestRun, finishDigestRun, getLastDeliveredDigestRun } from "../db/digestRuns";
import { getGmailConnectionStatus } from "../db/gmail";
import { sendSelfEmailViaGmail } from "../gmail/send";
import { renderDigestEmail } from "./render";
import { getDigestMinScore, getDigestTargetCount, getDigestCategoryFilter } from "./config";
import { resolveDigestSettings } from "./settings";
import { chooseDigestTransport, type DigestTransport } from "./transport";
import {
  dedupeDigestItemsByOrganization,
  filterDigestItemsByCategory,
  filterDigestQualifyingItems,
  sortByScoreDesc,
} from "./qualify";
import { siteUrl } from "@/lib/site-url";
import type { ApprovalQueueItem, QueueItemDetail } from "../types";

export type DigestSendResult = {
  status: "succeeded" | "failed" | "skipped_no_provider" | "skipped_disabled";
  itemCount: number;
  minScore: number;
  transport?: DigestTransport;
  error?: string;
};

const DEFAULT_FALLBACK_LOOKBACK_HOURS = 24;
/** Leads listed in one email. The backlog total is reported separately, so this is a readability cap. */
const MAX_DIGEST_ITEMS = 25;
/** Each assemble is ~10 queries; fanning all of them out at once times out against Supabase. */
const ASSEMBLE_CONCURRENCY = 4;

/**
 * Rank by score with one batched query, then assemble details only for the leads that will
 * actually appear in the email. Assembling the whole pending backlog first is what made the
 * digest time out before it could send.
 *
 * Walks the score-ranked shortlist until `limit` conference (or configured-category) org leads
 * are collected — one row per organization.
 */
async function assembleQualifying(
  queueItems: ApprovalQueueItem[],
  minScore: number,
  limit: number
): Promise<QueueItemDetail[]> {
  if (queueItems.length === 0 || limit <= 0) return [];
  const category = getDigestCategoryFilter();
  const scores = await scoresByQueueItemId(queueItems);
  const ranked = queueItems
    .map((item) => ({ item, score: scores.get(item.id) ?? -1 }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  const details: QueueItemDetail[] = [];
  const seenOrgs = new Set<string>();
  for (let i = 0; i < ranked.length && details.length < limit; i += ASSEMBLE_CONCURRENCY) {
    const batchItems = ranked.slice(i, i + ASSEMBLE_CONCURRENCY);
    const batch = await Promise.all(batchItems.map((item) => assembleQueueItemDetailFromQueueItem(item)));
    for (const detail of batch) {
      if (!detail) continue;
      if ((detail.score?.totalScore ?? -1) < minScore) continue;
      if (!filterDigestItemsByCategory([detail], category).length) continue;
      if (seenOrgs.has(detail.organization.id)) continue;
      seenOrgs.add(detail.organization.id);
      details.push(detail);
      if (details.length >= limit) break;
    }
  }
  return sortByScoreDesc(dedupeDigestItemsByOrganization(filterDigestQualifyingItems(details, minScore)));
}

/**
 * Loads pending queue items for the daily digest.
 *
 * Cutoff uses the last digest that actually delivered leads (item_count > 0), so empty heartbeat
 * sends cannot strand the pending backlog. Always backfills older pending leads (preferring
 * minScore+) up to the target count so the morning email can ship ~10 leads every day instead of
 * waiting forever for brand-new 70+ rows.
 *
 * Only organization leads in the configured category (default: conferences) are included —
 * one entry per org.
 */
export async function loadQualifyingDigestItems(minScore = getDigestMinScore()): Promise<{
  items: QueueItemDetail[];
  sinceIso: string;
  backlogCount: number;
  backfilled: boolean;
}> {
  const lastDelivered = await getLastDeliveredDigestRun();
  const sinceIso =
    lastDelivered?.finishedAt ?? new Date(Date.now() - DEFAULT_FALLBACK_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const targetCount = getDigestTargetCount();

  const [newQueueItems, backlogCount] = await Promise.all([listQueueItemsCreatedSince(sinceIso), countPendingQueueItems()]);
  let items = await assembleQualifying(newQueueItems, minScore, MAX_DIGEST_ITEMS);
  let backfilled = false;

  // Always fill toward the daily target from older pending leads (minScore first).
  if (items.length < targetCount) {
    const seenQueue = new Set(items.map((i) => i.queueItem.id));
    const seenOrgs = new Set(items.map((i) => i.organization.id));
    const allPending = (await listQueueItems("pending")).filter((item) => !seenQueue.has(item.id));
    const need = Math.min(targetCount, MAX_DIGEST_ITEMS) - items.length;
    const older = (await assembleQualifying(allPending, minScore, need + 8)).filter(
      (item) => !seenOrgs.has(item.organization.id)
    );
    if (older.length > 0) {
      items = dedupeDigestItemsByOrganization([...items, ...older]).slice(0, Math.min(targetCount, MAX_DIGEST_ITEMS));
      backfilled = true;
    }
  }

  // Still short? Fill remaining slots with next-best pending leads below minScore so we still
  // ship ~targetCount daily ("10 new no matter what") instead of deferring forever.
  if (items.length < targetCount) {
    const seenQueue = new Set(items.map((i) => i.queueItem.id));
    const seenOrgs = new Set(items.map((i) => i.organization.id));
    const allPending = (await listQueueItems("pending")).filter((item) => !seenQueue.has(item.id));
    const need = Math.min(targetCount, MAX_DIGEST_ITEMS) - items.length;
    const filler = (await assembleQualifying(allPending, 0, need + 8)).filter(
      (item) => !seenOrgs.has(item.organization.id)
    );
    if (filler.length > 0) {
      items = dedupeDigestItemsByOrganization([...items, ...filler]).slice(0, Math.min(targetCount, MAX_DIGEST_ITEMS));
      backfilled = true;
    }
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
  const items = await assembleQualifying(allPending, minScore, MAX_DIGEST_ITEMS);
  return { items, sinceIso, backlogCount };
}

/**
 * Sends the "new leads since last digest" email — the actual "in my inbox every morning" piece.
 *
 * Delivery is Gmail-only (connected account mailing itself). Resend is reserved for OCTO
 * marketing campaigns. Missing Gmail is recorded as `skipped_no_provider`, never an error —
 * same graceful-degradation contract as discovery/enrichment.
 *
 * Prefers leads scoring >= SALES_DIGEST_MIN_SCORE (default 70), then backfills to the daily
 * target from the pending backlog (including lower scores if needed). Cron callers use
 * `ensureDigestTarget`, which tops up then sends once per day rather than waiting forever.
 */
export async function sendDailyDigest(
  trigger: "manual" | "cron" = "cron",
  options?: { items?: QueueItemDetail[]; sinceIso?: string; backlogCount?: number; minScore?: number }
): Promise<DigestSendResult> {
  const digestSettings = await resolveDigestSettings();
  const minScore = options?.minScore ?? digestSettings.minScore;
  if (!digestSettings.enabled) {
    return { status: "skipped_disabled", itemCount: 0, minScore };
  }

  const gmail = await getGmailConnectionStatus().catch(() => ({ connected: false, email: null }));
  const chosen = chooseDigestTransport({
    configuredTo: digestSettings.recipient,
    gmailConnected: gmail.connected,
    gmailEmail: gmail.email,
  });
  const to = chosen.to;
  if (chosen.transport === "none" || !to) {
    return { status: "skipped_no_provider", itemCount: 0, minScore, transport: "none", error: chosen.reason };
  }

  const digestRun = await createDigestRun(trigger);

  try {
    const loaded =
      options?.items && options.sinceIso !== undefined && options.backlogCount !== undefined
        ? { items: options.items, sinceIso: options.sinceIso, backlogCount: options.backlogCount }
        : await loadQualifyingDigestItems(minScore);

    const { subject, html, text } = renderDigestEmail(
      loaded.items,
      {
        newCount: loaded.items.length,
        backlogCount: loaded.backlogCount,
        sinceIso: loaded.sinceIso,
        minScore,
        category: getDigestCategoryFilter(),
      },
      siteUrl()
    );

    const sent = await sendSelfEmailViaGmail({ subject, text, html });

    await finishDigestRun(digestRun.id, {
      status: "succeeded",
      itemCount: loaded.items.length,
      recipient: to,
      providerMessageId: sent.messageId,
    });
    return { status: "succeeded", itemCount: loaded.items.length, minScore, transport: "gmail" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await finishDigestRun(digestRun.id, { status: "failed", recipient: to, error: message });
    return { status: "failed", itemCount: 0, minScore, transport: chosen.transport, error: message };
  }
}
