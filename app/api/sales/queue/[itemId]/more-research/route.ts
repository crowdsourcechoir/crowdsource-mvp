import { NextResponse } from "next/server";
import { getQueueItem } from "@/lib/sales/db/queue";
import { getOpportunity, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { runPipelineForOrganization } from "@/lib/sales/pipeline/run-pipeline";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { ensureQueueItemActionable } from "@/lib/sales/outreach/queue-actionable";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Actually re-run research/pipeline for this org, then return the updated queue detail.
 * Does not send email.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const loaded = await getQueueItem(itemId);
    if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
    let item;
    try {
      item = await ensureQueueItemActionable(loaded);
    } catch (err) {
      const status = (err as Error & { status?: number }).status ?? 500;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status });
    }
    const opportunity = await getOpportunity(item.opportunityId);
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    await updateOpportunityStatus(opportunity.id, "researching");
    const summary = await runPipelineForOrganization(opportunity.organizationId, "reprocess_request");
    const detail = await assembleQueueItemDetailFromQueueItem((await getQueueItem(itemId)) ?? item);
    return NextResponse.json({ summary, detail, sent: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Research failed" }, { status: 500 });
  }
}
