import { NextResponse } from "next/server";
import { getEnrichmentConfigStatus } from "@/lib/sales/enrichment/config-status";

export const dynamic = "force-dynamic";

/** Presence of Hunter/Apollo keys in this runtime (no secret values). */
export async function GET() {
  try {
    const status = getEnrichmentConfigStatus();
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
