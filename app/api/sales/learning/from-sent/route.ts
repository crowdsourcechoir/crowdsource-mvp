import { NextResponse } from "next/server";
import { learnFromSentOutreach } from "@/lib/sales/learning/from-sent";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pull Joel's in-app sent edits + Gmail Sent (outside-app rewrites) into outreach_feedback
 * so the next AI drafts match what he actually sent.
 */
export async function POST() {
  try {
    const result = await learnFromSentOutreach(80);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not learn from sent mail") }, { status: 500 });
  }
}
