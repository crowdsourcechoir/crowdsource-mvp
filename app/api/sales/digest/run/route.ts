import { NextResponse } from "next/server";
import { ensureDigestTarget } from "@/lib/sales/digest/ensure";

export const dynamic = "force-dynamic";
/** May top up pipeline briefly before sending when under the 70+/10 target. */
export const maxDuration = 290;

/**
 * Manual trigger — runs the same ensure+send path as cron so a phone/admin "send now" can
 * recover stranded pending 70+ leads and actually deliver the morning email.
 */
export async function POST() {
  try {
    const result = await ensureDigestTarget("manual");
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
