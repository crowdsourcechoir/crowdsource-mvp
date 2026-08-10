import { NextResponse } from "next/server";
import { syncGmailReplies } from "@/lib/sales/gmail/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual reply-sync trigger from the admin UI. */
export async function POST() {
  try {
    const result = await syncGmailReplies();
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
