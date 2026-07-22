import { NextResponse } from "next/server";
import { listDigestRuns } from "@/lib/sales/db/digestRuns";

export const dynamic = "force-dynamic";

/** Recent digest send history for the admin UI (see components/sales/DigestClient.tsx). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const runs = await listDigestRuns(limit);
    return NextResponse.json({ runs }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
