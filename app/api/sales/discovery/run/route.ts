import { NextResponse } from "next/server";
import { SEARCH_DISABLED_REASON } from "@/lib/sales/discovery/search";

export const dynamic = "force-dynamic";

/** Manual discovery is retired — Tavily/Serper web search is off (Hunter only). */
export async function POST() {
  return NextResponse.json({ error: SEARCH_DISABLED_REASON, skipped: true }, { status: 409 });
}
