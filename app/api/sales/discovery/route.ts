import { NextResponse } from "next/server";
import { listDiscoveryRuns } from "@/lib/sales/db/discoveryRuns";

export const dynamic = "force-dynamic";

/** Recent discovery run history for the admin UI (see components/sales/DiscoveryRunClient.tsx). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const runs = await listDiscoveryRuns(limit);
    return NextResponse.json({ runs }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
