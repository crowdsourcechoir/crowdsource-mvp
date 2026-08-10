import { NextResponse } from "next/server";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getGmailConnectionStatus();
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
