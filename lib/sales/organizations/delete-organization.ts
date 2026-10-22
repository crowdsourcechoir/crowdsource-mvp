import { getOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { listOpportunitiesForOrganization, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { decideQueueItem } from "@/lib/sales/db/queue";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  DO_NOT_PROSPECT_REASON_OPERATOR_DELETED,
  isDoNotProspect,
  withDoNotProspect,
} from "@/lib/sales/prospecting/do-not-prospect";
import type { Organization } from "@/lib/sales/types";

export type DeleteOrganizationResult = {
  organization: Organization;
  alreadyHidden: boolean;
  queueItemsClosed: number;
};

/**
 * Soft-delete an organization from the sales queue: mark do-not-prospect and close
 * pending queue rows. Keeps contacts / history (same spirit as garden/bloom rare delete
 * for operator cleanup, without nuking outreach records).
 */
export async function deleteOrganizationFromQueue(organizationId: string): Promise<DeleteOrganizationResult> {
  const organization = await getOrganization(organizationId);
  if (!organization) throw new Error("Organization not found");

  const alreadyHidden = isDoNotProspect(organization.importMetadata);
  const updated = alreadyHidden
    ? organization
    : await updateOrganization(organizationId, {
        importMetadata: withDoNotProspect(organization.importMetadata, DO_NOT_PROSPECT_REASON_OPERATOR_DELETED),
      });

  const opportunities = await listOpportunitiesForOrganization(organizationId);
  const opportunityIds = opportunities.map((o) => o.id);
  let queueItemsClosed = 0;

  if (opportunityIds.length > 0) {
    const db = requireSupabaseAdmin();
    const pendingIds: string[] = [];
    for (let i = 0; i < opportunityIds.length; i += 100) {
      const chunk = opportunityIds.slice(i, i + 100);
      const { data, error } = await db
        .from("approval_queue_items")
        .select("id")
        .in("opportunity_id", chunk)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      for (const row of data ?? []) pendingIds.push(row.id as string);
    }

    for (const itemId of pendingIds) {
      await decideQueueItem(itemId, {
        status: "rejected",
        decisionNotes: "Organization deleted from queue by operator.",
        decidedBy: "operator",
      });
      queueItemsClosed += 1;
    }

    for (const opportunity of opportunities) {
      if (opportunity.status === "ready_for_review" || opportunity.status === "awaiting_contact") {
        await updateOpportunityStatus(opportunity.id, "rejected").catch(() => undefined);
      }
    }
  }

  return { organization: updated, alreadyHidden, queueItemsClosed };
}
