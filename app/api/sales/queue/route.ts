import { NextResponse } from "next/server";
import { listQueueItems, retractPendingQueueItemForOpportunity } from "@/lib/sales/db/queue";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { getMinLeadScore } from "@/lib/sales/digest/config";
import type { ApprovalQueueItemStatus } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as ApprovalQueueItemStatus | null) ?? undefined;
    const items = await listQueueItems(status);
    const [details, gmail] = await Promise.all([
      Promise.all(items.map((item) => assembleQueueItemDetailFromQueueItem(item))),
      getGmailConnectionStatus(),
    ]);

    const minScore = getMinLeadScore();
    const kept = [];
    for (const detail of details) {
      if (!detail) continue;
      // Nudges/follow-ups are for already-approved relationships — no score bar.
      if (detail.queueItem.kind === "nudge") {
        kept.push(detail);
        continue;
      }
      const score = detail.score?.totalScore ?? null;
      if (score == null || score < minScore) {
        // Clean up legacy junk that reached the queue before the solid-lead gate existed.
        if (detail.queueItem.status === "pending") {
          await retractPendingQueueItemForOpportunity(detail.opportunity.id).catch(() => false);
          if (detail.opportunity.status === "ready_for_review" || detail.opportunity.status === "awaiting_contact") {
            await updateOpportunityStatus(detail.opportunity.id, "needs_more_research").catch(() => null);
          }
        }
        continue;
      }
      kept.push(detail);
    }

    // Highest confidence / score first. Nudges and initials share the same queue; nudges without
    // a prospect score sort by draft confidence so high-trust follow-ups surface quickly.
    const sorted = kept.sort((a, b) => {
      const scoreA = a.score?.totalScore ?? (a.draft?.confidenceScore != null ? a.draft.confidenceScore * 100 : -1);
      const scoreB = b.score?.totalScore ?? (b.draft?.confidenceScore != null ? b.draft.confidenceScore * 100 : -1);
      return scoreB - scoreA;
    });
    return NextResponse.json({ items: sorted, gmail, minLeadScore: minScore }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
