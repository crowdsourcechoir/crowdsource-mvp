import { NextResponse } from "next/server";
import { loadSalesDashboardBuckets } from "@/lib/sales/db/dashboard";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** Lightweight counts for the sales home buckets — not the full queue/funnel payloads. */
export async function GET() {
  try {
    const buckets = await loadSalesDashboardBuckets();
    return NextResponse.json(buckets, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load sales dashboard") }, { status: 500 });
  }
}
