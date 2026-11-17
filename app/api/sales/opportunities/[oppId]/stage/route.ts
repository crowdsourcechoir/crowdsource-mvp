import { NextResponse } from "next/server";
import { getOpportunity, updateOpportunityRelationshipStage } from "@/lib/sales/db/opportunities";
import { clearParkedArtifacts } from "@/lib/sales/follow-up/park";
import type { RelationshipStage } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

const VALID_STAGES: RelationshipStage[] = ["awareness", "interest", "purchase", "lost"];

// Separate route from the queue decision endpoint on purpose: the queue decision is a one-time
// pipeline event (approve/reject/etc.), while a funnel stage move can happen repeatedly and in
// either direction (see updateOpportunityRelationshipStage) as the human tracks real replies.
export async function POST(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const body = await request.json();
    const stage = body?.stage as string;
    if (!VALID_STAGES.includes(stage as RelationshipStage)) {
      return NextResponse.json({ error: `Invalid stage "${stage}"` }, { status: 400 });
    }
    let opportunity = await updateOpportunityRelationshipStage(oppId, stage as RelationshipStage);
    // Moving back onto the active board drops the check-in hold. The reminder is not an email.
    if (stage !== "parked") {
      try {
        await clearParkedArtifacts(oppId);
        opportunity = (await getOpportunity(oppId)) ?? opportunity;
      } catch (clearErr) {
        console.warn("[parked-follow-up] clear after stage move failed:", clearErr);
      }
    }
    return NextResponse.json({ opportunity });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
