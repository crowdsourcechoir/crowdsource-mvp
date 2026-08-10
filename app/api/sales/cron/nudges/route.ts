import { NextResponse } from "next/server";
import { generateDueNudgeDrafts } from "@/lib/sales/gmail/nudge";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Generate AI nudge drafts for due leads and enqueue them for human approval. */
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
    const result = await generateDueNudgeDrafts();
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
