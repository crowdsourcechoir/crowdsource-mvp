import { NextResponse } from "next/server";
import { clearFailedEnrichmentAttempts } from "@/lib/sales/db/contacts";
import { listAwaitingContactOrganizationIds } from "@/lib/sales/db/awaitingContact";
import { getDigestMinScore } from "@/lib/sales/digest/config";

export const dynamic = "force-dynamic";

/**
 * Reset enrichment_attempted_at for contacts that failed with provider error,
 * so Hunter can be retried. Body optional: { organizationIds?: string[] }.
 * Defaults to solid awaiting_contact orgs.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let organizationIds: string[] | undefined = Array.isArray(body?.organizationIds)
      ? body.organizationIds.filter((id: unknown): id is string => typeof id === "string")
      : undefined;
    if (!organizationIds || organizationIds.length === 0) {
      const minScore = getDigestMinScore();
      const awaiting = await listAwaitingContactOrganizationIds(25, minScore);
      organizationIds = awaiting.filter((a) => a.score >= minScore).map((a) => a.organizationId);
    }
    const cleared = await clearFailedEnrichmentAttempts(organizationIds);
    return NextResponse.json({ cleared, organizationIds });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
