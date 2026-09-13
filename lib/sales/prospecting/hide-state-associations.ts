import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { listOpportunitiesForOrganization } from "@/lib/sales/db/opportunities";
import { listOrganizations, updateOrganization } from "@/lib/sales/db/organizations";
import { retractPendingQueueItemForOpportunity } from "@/lib/sales/db/queue";
import {
  DO_NOT_PROSPECT_REASON_STATE_ASSOC,
  isDoNotProspect,
  looksLikeStateOrRegionalAssociation,
  organizationHasBeenContacted,
  withDoNotProspect,
} from "@/lib/sales/prospecting/do-not-prospect";

export type HideStateAssociationsResult = {
  scannedOrganizations: number;
  matchedStateAssociations: number;
  hidden: number;
  keptContacted: number;
  alreadyHidden: number;
  pendingQueueItemsRetracted: number;
  hiddenNames: string[];
  keptContactedNames: string[];
};

/**
 * Mark uncontacted state/regional associations as do-not-prospect, retract their pending
 * queue rows, and leave org records in place. Already-contacted matches stay visible.
 */
export async function hideUncontactedStateAssociations(options?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<HideStateAssociationsResult> {
  requireSupabaseAdmin();
  const dryRun = Boolean(options?.dryRun);
  const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 10000) : 5000;

  const organizations = await listOrganizations({ limit });

  const result: HideStateAssociationsResult = {
    scannedOrganizations: organizations.length,
    matchedStateAssociations: 0,
    hidden: 0,
    keptContacted: 0,
    alreadyHidden: 0,
    pendingQueueItemsRetracted: 0,
    hiddenNames: [],
    keptContactedNames: [],
  };

  for (const org of organizations) {
    if (!looksLikeStateOrRegionalAssociation(org.name)) continue;
    result.matchedStateAssociations += 1;

    const opportunities = await listOpportunitiesForOrganization(org.id);

    if (organizationHasBeenContacted(opportunities)) {
      result.keptContacted += 1;
      result.keptContactedNames.push(org.name);
      continue;
    }

    if (isDoNotProspect(org.importMetadata)) {
      result.alreadyHidden += 1;
      if (!dryRun) {
        for (const opp of opportunities) {
          if (await retractPendingQueueItemForOpportunity(opp.id)) {
            result.pendingQueueItemsRetracted += 1;
          }
        }
      }
      continue;
    }

    result.hidden += 1;
    result.hiddenNames.push(org.name);
    if (dryRun) continue;

    await updateOrganization(org.id, {
      importMetadata: withDoNotProspect(org.importMetadata, DO_NOT_PROSPECT_REASON_STATE_ASSOC),
    });
    for (const opp of opportunities) {
      if (await retractPendingQueueItemForOpportunity(opp.id)) {
        result.pendingQueueItemsRetracted += 1;
      }
    }
  }

  return result;
}
