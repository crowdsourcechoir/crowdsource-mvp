import { NextResponse } from "next/server";
import { getHunterAccountCredits } from "@/lib/sales/enrichment/hunter-account";

export const dynamic = "force-dynamic";

/** Hunter account credit balance (free API call; no secret values). */
export async function GET() {
  try {
    const credits = await getHunterAccountCredits();
    return NextResponse.json(credits, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
