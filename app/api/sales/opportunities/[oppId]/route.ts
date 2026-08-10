import { NextResponse } from "next/server";
import { assembleOpportunityPageDetail } from "@/lib/sales/db/assemble";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const detail = await assembleOpportunityPageDetail(oppId);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
