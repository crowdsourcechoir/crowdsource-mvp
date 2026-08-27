import { NextResponse } from "next/server";
import { getQueueItem } from "@/lib/sales/db/queue";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Full review payload for one queue row. The list endpoint is sidebar-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const detail = await assembleQueueItemDetailFromQueueItem(item);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load queue item") }, { status: 500 });
  }
}
