import { listQueueItems, listQueueItemsCreatedSince, countPendingQueueItems, scoresByQueueItemId } from "../db/queue";
import { assembleQueueItemDetailFromQueueItem } from "../db/assemble";
import { createDigestRun, finishDigestRun, getLastDeliveredDigestRun, getLastSucceededDigestRun } from "../db/digestRuns";
import { getGmailConnectionStatus } from "../db/gmail";
import { sendSelfEmailViaGmail } from "../gmail/send";
import { renderDigestEmail } from "./render";
import { getDigestMinScore, getDigestTargetCount } from "./config";
import { resolveDigestSettings } from "./settings";
import { chooseDigestTransport, type DigestTransport } from "./transport";
import { filterDigestQualifyingItems, sortByScoreDesc } from "./qualify";
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
 */
async function assembleQualifying(
  queueItems: ApprovalQueueItem[],
  minScore: number,
  limit: number
): Promise<QueueItemDetail[]> {
  if (queueItems.length === 0 || limit <= 0) return [];
  const scores = await scoresByQueueItemId(queueItems);
  const shortlist = queueItems
    .map((item) => ({ item, score: scores.get(item.id) ?? -1 }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);

  const details: QueueItemDetail[] = [];
  for (let i = 0; i < shortlist.length; i += ASSEMBLE_CONCURRENCY) {
    const batch = await Promise.all(
      shortlist.slice(i, i + ASSEMBLE_CONCURRENCY).map((item) => assembleQueueItemDetailFromQueueItem(item))
    );
    details.push(...batch.filter((d): d is QueueItemDetail => d !== null));
  }
  return sortByScoreDesc(filterDigestQualifyingItems(details, minScore));
}

/**
 * Loads pending queue items that clear the digest min-score bar.
 *
 * Cutoff uses the last digest that actually delivered leads (item_count > 0), so empty heartbeat
 * sends cannot strand the pending 70+ backlog. If the most recent succeeded digest was empty and
 * we still don't have enough "new" leads, backfill from older pending 70+ leads until the target
 * count — a one-shot recovery that stops once a real digest lands.
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

  const [newQueueItems, backlogCount] = await Promise.all([listQueueItemsCreatedSince(sinceIso), countPendingQueueItems()]);
  let items = await assembleQualifying(newQueueItems, minScore, MAX_DIGEST_ITEMS);
  let backfilled = false;

  const shouldBackfill = items.length < targetCount && (!lastSucceeded || lastSucceeded.itemCount === 0);
  if (shouldBackfill) {
    const seen = new Set(items.map((i) => i.queueItem.id));
    const allPending = (await listQueueItems("pending")).filter((item) => !seen.has(item.id));
    const older = await assembleQualifying(allPending, minScore, MAX_DIGEST_ITEMS - items.length);
    items = [...items, ...older];
    backfilled = items.length > 0;
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
 * Only includes leads scoring >= SALES_DIGEST_MIN_SCORE (default 70). Cron callers should use
 * `ensureDigestTarget` so the email waits until SALES_DIGEST_TARGET_COUNT (default 10) qualify;
 * manual/admin sends still go out with whatever currently qualifies (including zero) for testing.
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
      { newCount: loaded.items.length, backlogCount: loaded.backlogCount, sinceIso: loaded.sinceIso, minScore },
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
