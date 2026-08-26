import { NextResponse } from "next/server";
import { setGmailSendsEnabled } from "@/lib/sales/db/gmail";

export const dynamic = "force-dynamic";

/** Pause or resume outbound Gmail without disconnecting the OAuth connection. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const enabled = body?.enabled;
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Send { enabled: true } or { enabled: false }." }, { status: 400 });
    }
    const status = await setGmailSendsEnabled(enabled);
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
