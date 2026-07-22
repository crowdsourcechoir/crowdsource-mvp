import { NextResponse } from "next/server";
import { assembleFunnelItems } from "@/lib/sales/db/assemble";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await assembleFunnelItems();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
