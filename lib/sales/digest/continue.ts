import { waitUntil } from "@vercel/functions";
import type { DigestEnsureResult } from "./ensure";

/** Base URL for chaining back into this deployment's digest cron. */
export function digestCronBaseUrl(request: Request): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

export function readContinuationDepth(request: Request): number {
  const raw = new URL(request.url).searchParams.get("continue");
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * Only keep chaining when a deferred ensure still has useful work ahead (unprocessed
 * orgs or near-miss salvage). Stops the chain when the funnel is empty so we don't
 * spin discovery forever.
 */
export function shouldContinueDigest(result: DigestEnsureResult): boolean {
  return result.status === "deferred" && result.continuationRecommended === true;
}

/**
 * From the pipeline cron (or any other caller): kick the digest route so it can keep
 * topping up toward 10×70 after this invocation. The digest route returns immediately and
 * runs ensure in waitUntil, so this is safe to call near maxDuration.
 */
export function scheduleDigestContinuation(options: {
  request: Request;
  cronSecret: string;
  result: DigestEnsureResult;
}): { scheduled: boolean; reason?: string } {
  const { request, cronSecret, result } = options;
  if (!shouldContinueDigest(result)) {
    return { scheduled: false, reason: "not_recommended" };
  }

  const url = new URL("/api/sales/cron/digest", digestCronBaseUrl(request));
  // Enter the async continuation path (continue>=1) so this kick returns immediately.
  url.searchParams.set("continue", "1");

  const run = async () => {
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      await res.text();
    } catch (err) {
      console.error("[digest] continuation schedule failed:", err);
    }
  };

  try {
    waitUntil(run());
  } catch {
    void run();
  }

  return { scheduled: true };
}
