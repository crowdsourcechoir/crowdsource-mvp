import { NextResponse } from "next/server";
import { listUnprocessedOrganizations } from "@/lib/sales/db/organizations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 20));
    const organizations = await listUnprocessedOrganizations(limit);
    return NextResponse.json({ organizations }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
