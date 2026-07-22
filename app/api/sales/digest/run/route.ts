import { NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/sales/digest/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual trigger — lets you test-send today's digest right now, before any cron fires. */
export async function POST() {
  try {
    const result = await sendDailyDigest("manual");
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
