import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { scanGmailForOrgContacts } from "@/lib/sales/gmail/scan-org-contacts";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Read recent Gmail and propose people who look like they belong to an organization. */
export async function POST() {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const result = await scanGmailForOrgContacts({ maxMessages: 300 });
    if (result.skippedReason) {
      return NextResponse.json({ error: result.skippedReason, result }, { status: 409 });
    }
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not scan Gmail") }, { status: 500 });
  }
}
