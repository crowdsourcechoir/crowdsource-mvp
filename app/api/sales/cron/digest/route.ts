import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { ensureDigestTarget } from "@/lib/sales/digest/ensure";
import {
  digestCronBaseUrl,
  readContinuationDepth,
  shouldContinueDigest,
} from "@/lib/sales/digest/continue";

export const dynamic = "force-dynamic";
/** Top-up may run discovery + pipeline batches before sending or chaining another tick. */
export const maxDuration = 290;

const DEFAULT_MAX_CONTINUATIONS = 40;

function readMaxContinuations(): number {
  const raw = process.env.SALES_DIGEST_CONTINUE_MAX;
  if (!raw) return DEFAULT_MAX_CONTINUATIONS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_CONTINUATIONS;
}

/**
 * Fire-and-forget the next digest invocation. Continuations (continue>=1) return a small ack
 * immediately and run ensure in waitUntil, so this fetch does not consume another full
 * maxDuration on the caller.
 */
async function kickNextContinuation(request: Request, cronSecret: string, nextDepth: number): Promise<void> {
  const url = new URL("/api/sales/cron/digest", digestCronBaseUrl(request));
  url.searchParams.set("continue", String(nextDepth));
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    await res.text();
  } catch (err) {
    console.error("[digest] continuation kick failed:", err);
  }
}

async function maybeChain(
  request: Request,
  cronSecret: string,
  result: Awaited<ReturnType<typeof ensureDigestTarget>>,
  continuationDepth: number
): Promise<{ scheduled: boolean; reason?: string; nextDepth?: number }> {
  if (!shouldContinueDigest(result)) {
    return { scheduled: false, reason: "not_recommended" };
  }
  const maxContinuations = readMaxContinuations();
  if (continuationDepth >= maxContinuations) {
    console.warn(
      `[digest] under target (${result.qualifyingCount}/${result.targetCount}) but hit SALES_DIGEST_CONTINUE_MAX=${maxContinuations}`
    );
    return { scheduled: false, reason: "max_continuations" };
  }
  const nextDepth = continuationDepth + 1;
  await kickNextContinuation(request, cronSecret, nextDepth);
  return { scheduled: true, nextDepth };
}

/**
 * Vercel Cron entry point (see vercel.json) — keeps working until at least
 * SALES_DIGEST_TARGET_COUNT (default 10) new queue items score ≥ SALES_DIGEST_MIN_SCORE
 * (default 70).
 *
 * - Initial cron ticks (`continue` absent/0) run ensure in-request (reliable for Vercel Cron),
 *   then kick a self-chain when still under target with work remaining.
 * - Chained ticks (`continue`>=1) ack immediately and run ensure in `waitUntil`, so the night
 *   can keep going past the cron window without stacking two full maxDuration budgets.
 *
 * Same `Authorization: Bearer $CRON_SECRET` gate as the other sales cron routes.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const continuationDepth = readContinuationDepth(request);
  const maxContinuations = readMaxContinuations();

  // Self-chained follow-ups: return fast, work in the background.
  if (continuationDepth > 0) {
    const work = async () => {
      try {
        const result = await ensureDigestTarget("cron");
        await maybeChain(request, cronSecret, result, continuationDepth);
      } catch (err) {
        console.error("[digest] continuation ensure failed:", err);
      }
    };
    try {
      waitUntil(work());
    } catch {
      void work();
    }
    return NextResponse.json({
      accepted: true,
      continuationDepth,
      maxContinuations,
      message: "Continuation ensure running in background; will keep chaining until 10×70 or work runs out.",
    });
  }

  // Initial cron / manual-style invoke: run ensure in-request so the cron response reflects status.
  try {
    const result = await ensureDigestTarget("cron");
    const continuation = await maybeChain(request, cronSecret, result, continuationDepth);
    return NextResponse.json({ result, continuation, continuationDepth, maxContinuations });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
