import { NextResponse } from "next/server";
import { finishQueueItem } from "@/lib/sales/queue/finish-run";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";

/**
 * Leave the send queue without emailing remaining contacts.
 * Already-sent people stay in the funnel. Remaining drafts are closed, not sent.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const result = await finishQueueItem(itemId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const status = typeof (err as { status?: number }).status === "number" ? (err as { status: number }).status : 500;
    return NextResponse.json({ error: publicErrorMessage(err, "Could not leave the queue") }, { status });
  }
}
