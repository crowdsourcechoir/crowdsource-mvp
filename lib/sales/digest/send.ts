import {
  listQueueItems,
  listQueueItemsCreatedSince,
  listPendingNeverDigestedQueueItems,
  markQueueItemsDigested,
  countPendingQueueItems,
  scoresByQueueItemId,
} from "../db/queue";
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
import {
  appendDigestedQueueItemIds,
  bootstrapDigestedIdsIfEmpty,
} from "./digested-ids";
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
 * actually appear in the email.
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
 * Loads pending queue items for the daily digest — net-new high scorers only.
 *
 * Only includes pending rows created since the last delivered digest (or the
 * lookback window), minus anything already marked digested in Postgres
 * (`last_digested_at`) or the soft-store. Never fills from older pending —
 * that path recycled the same 70+ conference orgs every morning when marks
 * were missing. Under-target is fine; `ensureDigestTarget` tops up overnight.
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
  const targetCount = Math.min(getDigestTargetCount(), MAX_DIGEST_ITEMS);
  const backlogCount = await countPendingQueueItems();

  const neverDigested = await listPendingNeverDigestedQueueItems();
  const allPending = neverDigested ?? (await listQueueItems("pending"));
  // Seed soft-store from historical pending so already-surfaced leads stay out
  // even when last_digested_at was never written by older digest sends.
  const digested = await bootstrapDigestedIdsIfEmpty(allPending, sinceIso);

  const freshUndigested = allPending.filter(
    (item) => item.createdAt >= sinceIso && !digested.has(item.id)
  );
  // Also pull created_at-since from the DB in case the never-digested query
  // paginated / truncated the in-memory list.
  const sinceRows = (await listQueueItemsCreatedSince(sinceIso)).filter((item) => !digested.has(item.id));
  const byId = new Map<string, (typeof allPending)[number]>();
  for (const item of [...freshUndigested, ...sinceRows]) byId.set(item.id, item);
  // When the column exists, drop anything already marked digested there.
  if (neverDigested) {
    const neverSet = new Set(neverDigested.map((i) => i.id));
    for (const id of [...byId.keys()]) {
      if (!neverSet.has(id)) byId.delete(id);
    }
  }

  const candidates = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const items = await assembleQualifying(candidates, minScore, targetCount);

  return { items, sinceIso, backlogCount, backfilled: false };
}

/** Force-resend path: still prefer never-digested so we don't re-spam the same set. */
export async function loadAllPendingDigestItems(minScore = getDigestMinScore()): Promise<{
  items: QueueItemDetail[];
  sinceIso: string;
  backlogCount: number;
}> {
  const loaded = await loadQualifyingDigestItems(minScore);
  return { items: loaded.items, sinceIso: loaded.sinceIso, backlogCount: loaded.backlogCount };
}

async function recordDigested(items: QueueItemDetail[]): Promise<void> {
  const ids = items.map((i) => i.queueItem.id);
  await markQueueItemsDigested(ids);
  await appendDigestedQueueItemIds(ids);
}

/**
 * Sends the morning digest of net-new high-scoring leads.
 *
 * Delivery is Gmail-only. Prefers ≥ SALES_DIGEST_MIN_SCORE never-digested conference orgs.
 * Marks included rows so they cannot reappear tomorrow.
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

    if (loaded.items.length === 0) {
      await finishDigestRun(digestRun.id, {
        status: "succeeded",
        itemCount: 0,
        recipient: to,
        providerMessageId: null,
      });
      return { status: "succeeded", itemCount: 0, minScore, transport: "gmail" };
    }

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
    await recordDigested(loaded.items);
    return { status: "succeeded", itemCount: loaded.items.length, minScore, transport: "gmail" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await finishDigestRun(digestRun.id, { status: "failed", recipient: to, error: message });
    return { status: "failed", itemCount: 0, minScore, transport: chosen.transport, error: message };
  }
}

/** Test helper — soft store read. */
export async function __testReadDigestedIds(): Promise<Set<string>> {
  return readDigestedQueueItemIds();
}
