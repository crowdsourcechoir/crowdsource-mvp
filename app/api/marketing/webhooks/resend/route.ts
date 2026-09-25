import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Resend webhook receiver.
 * Phase 1 does not persist provider events and does not write marketing/v1.json.
 * Phase 4 verifies the Svix signature and stores email_events.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  return NextResponse.json({ ok: true, stored: false });
}
