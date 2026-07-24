import { NextResponse } from "next/server";
import { ensureDigestTarget } from "@/lib/sales/digest/ensure";
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
 * the 70+/10-lead email target instead of waiting solely on the later digest cron ticks.
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
    try {
      digest = await ensureDigestTarget("cron");
    } catch (err) {
      digest = { status: "failed", error: err instanceof Error ? err.message : "Digest ensure failed" };
    }
    return NextResponse.json({ summary, digest });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
