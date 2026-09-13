import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { publicErrorMessage } from "@/lib/sales/http-error";
import { hideUncontactedStateAssociations } from "@/lib/sales/prospecting/hide-state-associations";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Hide uncontacted state/regional associations from the sales queue (keeps org rows).
 * Body: { dryRun?: boolean, limit?: number }
 */
export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean; limit?: number };
    const result = await hideUncontactedStateAssociations({
      dryRun: Boolean(body.dryRun),
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to hide state associations") }, { status: 500 });
  }
}
