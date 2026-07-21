import { NextResponse } from "next/server";
import { runDiscoveryRun } from "@/lib/sales/discovery/run-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Vercel Cron entry point (see vercel.json). Vercel calls this on schedule with an
 * `Authorization: Bearer $CRON_SECRET` header automatically once CRON_SECRET is set in the
 * project's environment variables — this route just verifies that header matches before doing
 * anything, so nobody else can trigger paid search/LLM calls by hitting this URL directly. If
 * CRON_SECRET isn't set at all, the route refuses every request rather than running unsecured.
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
    const summary = await runDiscoveryRun("cron");
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
