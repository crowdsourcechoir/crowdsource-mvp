import { NextResponse } from "next/server";
import { listQueueItems } from "@/lib/sales/db/queue";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
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
    // Highest confidence / score first. Nudges and initials share the same queue; nudges without
    // a prospect score sort by draft confidence so high-trust follow-ups surface quickly.
    const sorted = details
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => {
        const scoreA = a.score?.totalScore ?? (a.draft?.confidenceScore != null ? a.draft.confidenceScore * 100 : -1);
        const scoreB = b.score?.totalScore ?? (b.draft?.confidenceScore != null ? b.draft.confidenceScore * 100 : -1);
        return scoreB - scoreA;
      });
    return NextResponse.json({ items: sorted, gmail }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
