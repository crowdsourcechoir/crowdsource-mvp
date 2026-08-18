import { NextResponse } from "next/server";
import { getQueueItem } from "@/lib/sales/db/queue";
import { getOpportunity, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { runPipelineForOrganization } from "@/lib/sales/pipeline/run-pipeline";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Actually re-run research/pipeline for this org, then return the updated queue detail.
 * Does not send email.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.status !== "pending") {
      return NextResponse.json({ error: "Queue item already decided." }, { status: 409 });
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
