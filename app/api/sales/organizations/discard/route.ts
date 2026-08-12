import { NextResponse } from "next/server";
import { setOrganizationsDiscarded } from "@/lib/sales/db/organizations";
import { listOpportunitiesForOrganization } from "@/lib/sales/db/opportunities";
import { retractPendingQueueItemForOpportunity } from "@/lib/sales/db/queue";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";

export const dynamic = "force-dynamic";

/** Bulk discard (or restore) junk organizations so they leave the prospecting pool. */
export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const ids = Array.isArray(body?.organizationIds)
      ? (body.organizationIds as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "organizationIds (string[]) is required" }, { status: 400 });
    }
    if (ids.length > 100) {
      return NextResponse.json({ error: "Max 100 organizations per request" }, { status: 400 });
    }
    const discarded = body?.discarded !== false;

    const updated = await setOrganizationsDiscarded(ids, discarded);

    if (discarded) {
      for (const orgId of ids) {
        const opps = await listOpportunitiesForOrganization(orgId).catch(() => []);
        await Promise.all(opps.map((o) => retractPendingQueueItemForOpportunity(o.id).catch(() => false)));
      }
    }

    return NextResponse.json({ updated, discarded });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
