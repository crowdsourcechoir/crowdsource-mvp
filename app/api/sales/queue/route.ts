import { NextResponse } from "next/server";
import { listQueueSidebarByScope } from "@/lib/sales/db/queue";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { publicErrorMessage } from "@/lib/sales/http-error";
import { parseQueueScope } from "@/lib/sales/queue/scope";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = parseQueueScope(searchParams.get("scope"));
    const [items, gmail] = await Promise.all([
      listQueueSidebarByScope(scope),
      getGmailConnectionStatus(),
    ]);
    return NextResponse.json({ items, gmail, scope }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load queue") }, { status: 500 });
  }
}
