import { NextResponse } from "next/server";
import { listQueueItems } from "@/lib/sales/db/queue";
import { assembleQueueItemDetail } from "@/lib/sales/db/assemble";
import type { ApprovalQueueItemStatus } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as ApprovalQueueItemStatus | null) ?? undefined;
    const items = await listQueueItems(status);
    const details = await Promise.all(items.map((item) => assembleQueueItemDetail(item.opportunityId)));
    // Highest-ranked prospects first — this is the primary daily review surface, so the leads
    // most worth a human's limited attention should never be buried behind older-but-lower-scoring
    // ones. Unscored items (shouldn't normally happen by the time something reaches the queue,
    // but defensively handled) sort last rather than being treated as a false "0".
    const sorted = details
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => (b.score?.totalScore ?? -1) - (a.score?.totalScore ?? -1));
    return NextResponse.json({ items: sorted }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
