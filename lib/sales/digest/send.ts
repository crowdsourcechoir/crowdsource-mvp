import { Resend } from "resend";
import { listQueueItemsCreatedSince, countPendingQueueItems } from "../db/queue";
import { assembleQueueItemDetail } from "../db/assemble";
import { createDigestRun, finishDigestRun, getLastSucceededDigestRun } from "../db/digestRuns";
import { renderDigestEmail } from "./render";
import { siteUrl } from "@/lib/site-url";
import type { QueueItemDetail } from "../types";

export type DigestSendResult = {
  status: "succeeded" | "failed" | "skipped_no_provider";
  itemCount: number;
  error?: string;
};

const DEFAULT_FALLBACK_LOOKBACK_HOURS = 24;
const DEFAULT_FROM = "Crowdsource Sales <onboarding@resend.dev>";

function sortByScoreDesc(items: QueueItemDetail[]): QueueItemDetail[] {
  return [...items].sort((a, b) => (b.score?.totalScore ?? -1) - (a.score?.totalScore ?? -1));
}

/**
 * Sends the "new leads since last digest" email — the actual "in my inbox every morning" piece.
 * A no-op (recorded as `skipped_no_provider`, never an error) if RESEND_API_KEY or
 * SALES_DIGEST_TO_EMAIL aren't set, same graceful-degradation contract as discovery/enrichment
 * (see docs/sales-platform/roadmap.md). Always sends, even when there's nothing new — see
 * render.ts — since silence on a broken pipeline is worse than a "nothing new" email; the digest
 * doubles as an "is this thing still running" heartbeat.
 */
export async function sendDailyDigest(trigger: "manual" | "cron" = "cron"): Promise<DigestSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SALES_DIGEST_TO_EMAIL;
  if (!apiKey || !to) {
    return { status: "skipped_no_provider", itemCount: 0 };
  }

  const digestRun = await createDigestRun(trigger);

  try {
    const lastDigest = await getLastSucceededDigestRun();
    const sinceIso = lastDigest?.finishedAt ?? new Date(Date.now() - DEFAULT_FALLBACK_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

    const [newQueueItems, backlogCount] = await Promise.all([listQueueItemsCreatedSince(sinceIso), countPendingQueueItems()]);
    const details = (await Promise.all(newQueueItems.map((qi) => assembleQueueItemDetail(qi.opportunityId)))).filter(
      (d): d is QueueItemDetail => d !== null
    );
    const sorted = sortByScoreDesc(details);

    const { subject, html, text } = renderDigestEmail(sorted, { newCount: sorted.length, backlogCount, sinceIso }, siteUrl());

    const resend = new Resend(apiKey);
    const from = process.env.SALES_DIGEST_FROM_EMAIL || DEFAULT_FROM;
    const { data, error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(typeof error === "string" ? error : error.message);

    await finishDigestRun(digestRun.id, {
      status: "succeeded",
      itemCount: sorted.length,
      recipient: to,
      providerMessageId: data?.id ?? null,
    });
    return { status: "succeeded", itemCount: sorted.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await finishDigestRun(digestRun.id, { status: "failed", recipient: to, error: message });
    return { status: "failed", itemCount: 0, error: message };
  }
}
