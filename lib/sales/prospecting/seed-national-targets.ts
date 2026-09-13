import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import {
  createOrganization,
  findExistingOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { withSalesInitiative } from "@/lib/sales/initiatives";
import { runPipelineForOrganization } from "@/lib/sales/pipeline/run-pipeline";
import {
  NATIONAL_KEYNOTE_TARGETS,
  type NationalKeynoteTarget,
} from "@/lib/sales/prospecting/national-keynote-targets";
import { isDoNotProspect } from "@/lib/sales/prospecting/do-not-prospect";
import type { Organization } from "@/lib/sales/types";

export type SeedNationalTargetsResult = {
  attempted: number;
  created: number;
  updated: number;
  skippedDoNotProspect: number;
  pipelineRuns: number;
  pipelineSkipped: number;
  errors: Array<{ name: string; error: string }>;
  organizations: Array<{ id: string; name: string; created: boolean; pipelineStatus: string | null }>;
};

async function upsertNationalTarget(target: NationalKeynoteTarget): Promise<{
  organization: Organization;
  created: boolean;
}> {
  const orgType = await findOrganizationTypeByKey(target.organizationTypeKey);
  const existing = await findExistingOrganization(target.name, target.websiteUrl);
  if (existing) {
    if (isDoNotProspect(existing.importMetadata)) {
      return { organization: existing, created: false };
    }
    const updated = await updateOrganization(existing.id, {
      websiteUrl: target.websiteUrl,
      organizationTypeId: orgType?.id ?? existing.organizationTypeId,
      importMetadata: withSalesInitiative(
        {
          ...(existing.importMetadata ?? {}),
          keynoteTier: true,
          keynoteNotes: target.notes,
          seededNationalKeynote: true,
        },
        target.salesInitiative
      ),
    });
    return { organization: updated, created: false };
  }

  const created = await createOrganization({
    name: target.name,
    websiteUrl: target.websiteUrl,
    organizationTypeId: orgType?.id ?? null,
    source: "manual",
    importMetadata: withSalesInitiative(
      {
        keynoteTier: true,
        keynoteNotes: target.notes,
        seededNationalKeynote: true,
      },
      target.salesInitiative
    ),
  });
  return { organization: created, created: true };
}

/**
 * Upsert the curated national keynote-tier org list and optionally run the pipeline
 * (research → contact discovery → Hunter enrich) so credits go at high-value targets.
 */
export async function seedNationalKeynoteTargets(options?: {
  runPipeline?: boolean;
  limit?: number;
}): Promise<SeedNationalTargetsResult> {
  const runPipeline = options?.runPipeline !== false;
  const limit =
    options?.limit && options.limit > 0
      ? Math.min(options.limit, NATIONAL_KEYNOTE_TARGETS.length)
      : NATIONAL_KEYNOTE_TARGETS.length;
  const targets = NATIONAL_KEYNOTE_TARGETS.slice(0, limit);

  const result: SeedNationalTargetsResult = {
    attempted: targets.length,
    created: 0,
    updated: 0,
    skippedDoNotProspect: 0,
    pipelineRuns: 0,
    pipelineSkipped: 0,
    errors: [],
    organizations: [],
  };

  for (const target of targets) {
    try {
      const { organization, created } = await upsertNationalTarget(target);
      if (isDoNotProspect(organization.importMetadata)) {
        result.skippedDoNotProspect += 1;
        result.organizations.push({
          id: organization.id,
          name: organization.name,
          created: false,
          pipelineStatus: "skipped_do_not_prospect",
        });
        continue;
      }
      if (created) result.created += 1;
      else result.updated += 1;

      let pipelineStatus: string | null = null;
      if (runPipeline) {
        const summary = await runPipelineForOrganization(organization.id, "manual");
        pipelineStatus = summary.status;
        if (summary.status === "skipped_do_not_prospect" || summary.status === "skipped_existing_client") {
          result.pipelineSkipped += 1;
        } else {
          result.pipelineRuns += 1;
        }
      }
      result.organizations.push({
        id: organization.id,
        name: organization.name,
        created,
        pipelineStatus,
      });
    } catch (err) {
      result.errors.push({
        name: target.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
