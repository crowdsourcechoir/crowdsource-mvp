import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { decideGmailContactSuggestion } from "@/lib/sales/gmail/scan-org-contacts";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Approve adds the person onto the organization. Dismiss leaves them off. */
export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const action = body?.action === "approve" || body?.action === "dismiss" ? body.action : null;
    if (!id || !action) {
      return NextResponse.json({ error: "id and action are required" }, { status: 400 });
    }
    const result = await decideGmailContactSuggestion(id, action);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not update suggestion") }, { status: 400 });
  }
}
