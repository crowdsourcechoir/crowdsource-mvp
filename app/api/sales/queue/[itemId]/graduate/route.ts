import { NextResponse } from "next/server";
import { graduateQueueItem } from "@/lib/sales/outreach/graduate-queue";
import type { RelationshipStage } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

const FUNNEL_STAGES = new Set<RelationshipStage>(["awareness", "interest", "purchase", "lost"]);

/**
 * Move this org out of the approval queue without emailing leftover contacts.
 * Remaining open drafts are skipped (rejected, not sent). Contacts stay on the org.
 * Optional `funnelStage` puts it on /admin/sales/funnel; otherwise sent orgs stay in
 * Awareness and unsent orgs go back to Organizations only.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const rawStage = typeof body?.funnelStage === "string" ? body.funnelStage : null;
    const funnelStage =
      rawStage && FUNNEL_STAGES.has(rawStage as RelationshipStage) ? (rawStage as RelationshipStage) : null;

    const result = await graduateQueueItem({
      itemId,
      funnelStage,
      decidedBy: typeof body?.decidedBy === "string" ? body.decidedBy : "operator",
      notes: typeof body?.notes === "string" ? body.notes : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status });
  }
}
