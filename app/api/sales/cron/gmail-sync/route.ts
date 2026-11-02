import { NextResponse } from "next/server";
import { scanGmailForOrgContactsIfStale } from "@/lib/sales/gmail/scan-org-contacts";
import { syncGmailReplies } from "@/lib/sales/gmail/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Poll Gmail for live replies, auto-replies, and bounces; update funnel / activity timeline. */
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
    let contactScan: Awaited<ReturnType<typeof scanGmailForOrgContactsIfStale>> | { error: string } | null = null;
    try {
      contactScan = await scanGmailForOrgContactsIfStale();
    } catch (err) {
      contactScan = { error: err instanceof Error ? err.message : "Contact scan failed" };
    }
    return NextResponse.json({ result, contactScan });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
