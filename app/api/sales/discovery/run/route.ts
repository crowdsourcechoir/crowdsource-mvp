import { NextResponse } from "next/server";
import { runDiscoveryRun } from "@/lib/sales/discovery/run-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual trigger — lets you test a discovery run today from the admin UI, before any cron ever fires. */
export async function POST() {
  try {
    const summary = await runDiscoveryRun("manual");
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
