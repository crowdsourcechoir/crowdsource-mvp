import { NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/sales/digest/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron entry point (see vercel.json) — the "new leads in my inbox every morning" piece.
 * Runs after the discovery and pipeline-processing crons so there's something fresh to report.
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

  try {
    const result = await sendDailyDigest("cron");
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
