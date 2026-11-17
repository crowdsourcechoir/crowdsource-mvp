import { NextResponse } from "next/server";
import { tickAutoSend } from "@/lib/sales/autosend/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Sends the outreach emails that are due inside weekdays 8:00am–5:00pm Pacific,
 * then mails one report once that day's line is finished.
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
    const tick = await tickAutoSend();
    return NextResponse.json(tick);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
