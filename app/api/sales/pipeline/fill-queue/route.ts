import { NextResponse } from "next/server";
import { listAwaitingContactOrganizationIds } from "@/lib/sales/db/awaitingContact";
import { getDigestMinScore } from "@/lib/sales/digest/config";
import { fillQueueFromAwaitingContact } from "@/lib/sales/pipeline/fill-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Preview how many high-scoring awaiting_contact orgs are blocked from the queue. */
export async function GET() {
  try {
    const minScore = getDigestMinScore();
    const candidates = await listAwaitingContactOrganizationIds(25, minScore);
    const solid = candidates.filter((c) => c.score >= minScore);
    return NextResponse.json({
      minScore,
      solidCount: solid.length,
      nearMissCount: candidates.length - solid.length,
      candidates,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

/**
 * Reprocess high-scoring awaiting_contact orgs so they can clear the verified-email gate
 * and land in the approval queue. Body: { limit?: number } (default 10, max 25).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : 10;
    const summary = await fillQueueFromAwaitingContact(limit);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
