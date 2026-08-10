import { NextResponse } from "next/server";
import { syncGmailReplies } from "@/lib/sales/gmail/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Poll Gmail for replies and update funnel / activity timeline. */
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
    const result = await syncGmailReplies();
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
