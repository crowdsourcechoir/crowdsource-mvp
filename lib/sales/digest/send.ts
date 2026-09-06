import { Resend } from "resend";
import { listQueueItems, listQueueItemsCreatedSince, countPendingQueueItems } from "../db/queue";
import { assembleQueueItemDetail } from "../db/assemble";
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
const DEFAULT_FROM = "Crowdsource Sales <onboarding@resend.dev>";

async function assembleMany(queueItems: ApprovalQueueItem[]): Promise<QueueItemDetail[]> {
  return (await Promise.all(queueItems.map((qi) => assembleQueueItemDetail(qi.opportunityId)))).filter(
    (d): d is QueueItemDetail => d !== null
  );
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
  let items = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(newQueueItems), minScore));
  let backfilled = false;

  const shouldBackfill = items.length < targetCount && (!lastSucceeded || lastSucceeded.itemCount === 0);
  if (shouldBackfill) {
    const allPending = await listQueueItems("pending");
    const older = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(allPending), minScore));
    const seen = new Set(items.map((i) => i.queueItem.id));
    const merged = [...items];
    for (const item of older) {
      if (seen.has(item.queueItem.id)) continue;
      seen.add(item.queueItem.id);
      merged.push(item);
    }
    items = merged;
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
  const items = sortByScoreDesc(filterDigestQualifyingItems(await assembleMany(allPending), minScore));
  return { items, sinceIso, backlogCount };
}

async function sendViaResend(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string | null> {
  const resend = new Resend(input.apiKey);
  const { data, error } = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) throw new Error(typeof error === "string" ? error : error.message);
  return data?.id ?? null;
}

/**
 * Sends the "new leads since last digest" email — the actual "in my inbox every morning" piece.
 *
 * Delivery goes through Resend when a verified sender is configured, otherwise through the
 * connected Gmail account mailing itself. Resend's sandbox sender only reaches the Resend
 * account owner, which is why every cron tick failed before the Gmail path existed.
 * Missing both is recorded as `skipped_no_provider`, never an error — same graceful-degradation
 * contract as discovery/enrichment (see docs/sales-platform/roadmap.md).
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

  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const gmail = await getGmailConnectionStatus().catch(() => ({ connected: false, email: null }));
  const chosen = chooseDigestTransport({
    resendApiKey: apiKey,
    resendFrom: digestSettings.fromEmail || DEFAULT_FROM,
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

    const canFallBackToGmail = gmail.connected && gmail.email?.toLowerCase() === to.toLowerCase();
    let transport = chosen.transport;
    let providerMessageId: string | null = null;

    if (transport === "resend" && apiKey) {
      try {
        providerMessageId = await sendViaResend({
          apiKey,
          from: digestSettings.fromEmail || DEFAULT_FROM,
          to,
          subject,
          html,
          text,
        });
      } catch (resendErr) {
        if (!canFallBackToGmail) throw resendErr;
        console.warn("[digest] Resend send failed, falling back to Gmail:", resendErr);
        transport = "gmail";
      }
    }

    if (transport === "gmail") {
      const sent = await sendSelfEmailViaGmail({ subject, text, html });
      providerMessageId = sent.messageId;
    }

    await finishDigestRun(digestRun.id, {
      status: "succeeded",
      itemCount: loaded.items.length,
      recipient: to,
      providerMessageId,
    });
    return { status: "succeeded", itemCount: loaded.items.length, minScore, transport };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await finishDigestRun(digestRun.id, { status: "failed", recipient: to, error: message });
    return { status: "failed", itemCount: 0, minScore, transport: chosen.transport, error: message };
  }
}
