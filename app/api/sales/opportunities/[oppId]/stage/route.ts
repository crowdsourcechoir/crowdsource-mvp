import { NextResponse } from "next/server";
import { updateOpportunityRelationshipStage } from "@/lib/sales/db/opportunities";
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
    const opportunity = await updateOpportunityRelationshipStage(oppId, stage as RelationshipStage);
    return NextResponse.json({ opportunity });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
