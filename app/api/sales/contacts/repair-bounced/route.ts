import { NextResponse } from "next/server";
import { listBouncedEmailRepairs, repairBouncedContactEmails } from "@/lib/sales/contacts/repairBouncedEmails";

export const dynamic = "force-dynamic";

/**
 * GET — preview the AORN / NACADA / U.S. Conference of Mayors bounce replacements (no DB writes).
 * POST — apply them: invalidate bounced addresses, upsert public verified contacts, retarget drafts.
 *
 * Optional body: `{ "organizationIds": ["…"] }` to limit to a subset.
 */
export async function GET() {
  return NextResponse.json({ repairs: listBouncedEmailRepairs() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    let organizationIds: string[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.organizationIds)) {
        organizationIds = body.organizationIds.filter((id: unknown) => typeof id === "string");
      }
    } catch {
      // empty body is fine
    }
    const results = await repairBouncedContactEmails({ organizationIds });
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
