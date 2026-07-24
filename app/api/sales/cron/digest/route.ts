import { NextResponse } from "next/server";
import { ensureDigestTarget } from "@/lib/sales/digest/ensure";

export const dynamic = "force-dynamic";
/** Top-up may run a discovery pass + a pipeline batch before deciding to send or defer. */
export const maxDuration = 290;

/**
 * Vercel Cron entry point (see vercel.json) — the "new leads in my inbox every morning" piece.
 * Waits until at least SALES_DIGEST_TARGET_COUNT (default 10) new queue items score at least
 * SALES_DIGEST_MIN_SCORE (default 70), topping up discovery/pipeline within this invocation when
 * short, and deferring (without advancing the cutoff) so later cron ticks can continue. Same
 * `Authorization: Bearer $CRON_SECRET` gate as the other sales cron routes.
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
    const result = await ensureDigestTarget("cron");
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
