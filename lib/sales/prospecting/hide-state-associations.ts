import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { listOpportunitiesForOrganization } from "@/lib/sales/db/opportunities";
import { updateOrganization } from "@/lib/sales/db/organizations";
import { retractPendingQueueItemForOpportunity } from "@/lib/sales/db/queue";
import {
  DO_NOT_PROSPECT_REASON_STATE_ASSOC,
  isDoNotProspect,
  looksLikeStateOrRegionalAssociation,
  organizationHasBeenContacted,
  withDoNotProspect,
} from "@/lib/sales/prospecting/do-not-prospect";
import type { Organization } from "@/lib/sales/types";

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

function rowToOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    normalizedName: row.normalized_name as string,
    domain: (row.domain as string | null) ?? null,
    organizationTypeId: (row.organization_type_id as string | null) ?? null,
    industrySegmentId: (row.industry_segment_id as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    locationCity: (row.location_city as string | null) ?? null,
    locationRegion: (row.location_region as string | null) ?? null,
    locationCountry: (row.location_country as string | null) ?? null,
    estimatedSize: (row.estimated_size as string | null) ?? null,
    source: (row.source as Organization["source"]) ?? "manual",
    duplicateOfOrganizationId: (row.duplicate_of_organization_id as string | null) ?? null,
    isExistingClient: (row.is_existing_client as boolean) ?? false,
    importMetadata: (row.import_metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** PostgREST defaults to max 1,000 rows per select — page until exhausted or `limit`. */
async function listAllOrganizations(limit: number): Promise<Organization[]> {
  const db = requireSupabaseAdmin();
  const pageSize = 1000;
  const out: Organization[] = [];
  let offset = 0;
  while (out.length < limit) {
    const take = Math.min(pageSize, limit - out.length);
    const { data, error } = await db
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []).map((row) => rowToOrg(row as Record<string, unknown>));
    if (page.length === 0) break;
    out.push(...page);
    if (page.length < take) break;
    offset += page.length;
  }
  return out;
}

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
  const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 20000) : 10000;

  const organizations = await listAllOrganizations(limit);

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
