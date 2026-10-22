import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { readContactSuggestionStore } from "@/lib/sales/gmail/contact-suggestion-store";
import { listPendingContactSuggestions } from "@/lib/sales/gmail/scan-org-contacts";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";

/** Pending “add this person to this organization?” rows from the Gmail scan. */
export async function GET(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    const [{ store, error }, suggestions] = await Promise.all([
      readContactSuggestionStore(),
      listPendingContactSuggestions(organizationId),
    ]);
    return NextResponse.json({
      suggestions,
      pending: suggestions.length,
      lastScannedAt: store.lastScannedAt,
      error,
    });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not load contact suggestions") }, { status: 500 });
  }
}
