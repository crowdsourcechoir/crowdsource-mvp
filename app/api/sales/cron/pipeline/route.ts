import { NextResponse } from "next/server";
import { ensureDigestTarget } from "@/lib/sales/digest/ensure";
import { scheduleDigestContinuation } from "@/lib/sales/digest/continue";
import { runPipelineBatch } from "@/lib/sales/pipeline/run-pipeline-batch";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

/**
 * Vercel Cron entry point (see vercel.json) — the Phase 2 "pipeline-processing cron" flagged as
 * not-yet-built in docs/sales-platform/architecture.md §6/roadmap.md. Same
 * `Authorization: Bearer $CRON_SECRET` gate as /api/sales/cron/discovery; refuses every request,
 * including Vercel's own, if CRON_SECRET isn't set.
 *
 * After each batch, also runs the digest ensure step so overnight processing keeps working toward
 * the 70+/10-lead email target. If still under target with work remaining, kicks off a digest
 * self-chain so the night continues until 10×70 instead of waiting on later cron ticks.
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

  try {
    const limit = Number(process.env.SALES_PIPELINE_BATCH_SIZE) || undefined;
    const summary = await runPipelineBatch(limit);
    // Best-effort: never fail the pipeline cron if digest ensure errors (email/provider issues).
    let digest = null;
    let continuation = null;
    try {
      digest = await ensureDigestTarget("cron");
      continuation = scheduleDigestContinuation({ request, cronSecret, result: digest });
    } catch (err) {
      digest = { status: "failed", error: err instanceof Error ? err.message : "Digest ensure failed" };
    }
    return NextResponse.json({ summary, digest, continuation });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
