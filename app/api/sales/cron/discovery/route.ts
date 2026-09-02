import { NextResponse } from "next/server";
import { SEARCH_DISABLED_REASON } from "@/lib/sales/discovery/search";

export const dynamic = "force-dynamic";

/**
 * Discovery cron is retired. Tavily/Serper web search is off (Hunter only).
 * Kept so leftover Vercel schedules fail closed instead of spending OpenAI.
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

  return NextResponse.json({ skipped: true, reason: SEARCH_DISABLED_REASON });
}
