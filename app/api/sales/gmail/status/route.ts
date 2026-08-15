import { NextResponse } from "next/server";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getGmailConnectionStatus();
    const sendsEnabled = process.env.SALES_GMAIL_SENDS_ENABLED?.trim() === "true";
    return NextResponse.json(
      { ...status, sendsEnabled },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
