import { NextResponse } from "next/server";
import { assembleFunnelItems } from "@/lib/sales/db/assemble";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await assembleFunnelItems();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load funnel") }, { status: 500 });
  }
}
