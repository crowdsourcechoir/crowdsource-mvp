import { NextResponse } from "next/server";
import { backfillAcceptedEditFeedback } from "@/lib/sales/db/feedback";

export const dynamic = "force-dynamic";

/** One-shot / occasional: turn past approved-with-edits drafts into learning feedback. */
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    const auth = request.headers.get("authorization") ?? "";
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await backfillAcceptedEditFeedback(200);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
