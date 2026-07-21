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
    return NextResponse.json({ items: details.filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
