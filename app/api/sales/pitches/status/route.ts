import { NextResponse } from "next/server";
import { getGmailConnectionStatus, getGmailConnection } from "@/lib/sales/db/gmail";
import { hasSlidesScopes, GOOGLE_PRESENTATIONS_SCOPE, GOOGLE_DRIVE_FILE_SCOPE } from "@/lib/sales/pitches/constants";
import { readPitchStore } from "@/lib/sales/pitches/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [status, connection, stored] = await Promise.all([
      getGmailConnectionStatus(),
      getGmailConnection().catch(() => null),
      readPitchStore(),
    ]);
    const scopes = connection?.scopes ?? [];
    const googleScopes = scopes.filter((s) => !s.startsWith("csc:"));
    const slidesGranted = hasSlidesScopes(scopes);
    const templates = stored.store.templates.filter((t) => t.isActive);

    return NextResponse.json(
      {
        connected: status.connected,
        email: status.email,
        configured: status.configured,
        slidesGranted,
        requiredScopes: [GOOGLE_PRESENTATIONS_SCOPE, GOOGLE_DRIVE_FILE_SCOPE],
        grantedScopes: googleScopes,
        settings: stored.store.settings,
        templates,
        pitchCount: stored.store.pitches.filter((p) => p.status !== "archived").length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
