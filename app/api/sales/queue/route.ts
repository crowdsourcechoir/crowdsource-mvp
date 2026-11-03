import { NextResponse } from "next/server";
import { loadSalesDashboardBuckets } from "@/lib/sales/db/dashboard";
import { listQueueSidebarByFunnelStage, listQueueSidebarByScope } from "@/lib/sales/db/queue";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { publicErrorMessage } from "@/lib/sales/http-error";
import { matchesQueueFunnel, parseQueueFunnel } from "@/lib/sales/queue/funnel";
import { parseQueueScope } from "@/lib/sales/queue/scope";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = parseQueueScope(searchParams.get("scope"));
    const funnel = parseQueueFunnel(searchParams.get("funnel"));
    const [buckets, gmail] = await Promise.all([
      loadSalesDashboardBuckets(),
      getGmailConnectionStatus(),
    ]);
    const scoped =
      scope === "due" || funnel === "all"
        ? await listQueueSidebarByScope(scope)
        : await listQueueSidebarByFunnelStage(funnel);
    const items =
      scope === "due" && funnel !== "all"
        ? scoped.filter((item) => matchesQueueFunnel(item.relationshipStage, funnel))
        : scoped;
    return NextResponse.json(
      {
        items,
        gmail,
        scope,
        funnel,
        funnelByStage: buckets.funnelByStage,
        funnelCount: buckets.funnelCount,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load queue") }, { status: 500 });
  }
}
