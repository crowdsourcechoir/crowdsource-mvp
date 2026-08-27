import { NextResponse } from "next/server";
import { listQueueSidebarItems } from "@/lib/sales/db/queue";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { publicErrorMessage } from "@/lib/sales/http-error";
import type { ApprovalQueueItemStatus } from "@/lib/sales/types";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as ApprovalQueueItemStatus | null) ?? undefined;
    const [items, gmail] = await Promise.all([
      listQueueSidebarItems(status),
      getGmailConnectionStatus(),
    ]);
    return NextResponse.json({ items, gmail }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load queue") }, { status: 500 });
  }
}
