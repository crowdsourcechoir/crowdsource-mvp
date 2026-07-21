import { callStructured } from "../../openai/client";
import { buildOpportunityDetectionSchema } from "../../openai/schemas";
import { listOpportunityTypes, findOpportunityTypeByKey } from "../../db/lookups";
import { createOpportunity, findExistingOpportunityByTitle, listOpportunitiesForOrganization } from "../../db/opportunities";
import { listFindingsForOrganization } from "../../db/research";
import { indexFindingsForPrompt, resolveFindingIds } from "../context";
import type { Organization, Opportunity } from "../../types";

export type DetectOpportunitiesStageOutput = {
  existingCount: number;
  createdCount: number;
  opportunityIds: string[];
  skippedReason?: string;
};

/** Product decision: one opportunity per organization. A human can still add a second manually if a real, separate case comes up. */
const MAX_OPPORTUNITIES_PER_ORGANIZATION = 1;

const SYSTEM_PROMPT = `Given an organization and researched findings, identify specific reasons a participatory choir/anthem live-audience experience could be relevant to them (e.g. an annual conference, employee gathering, fan engagement initiative, season launch, orientation, gala, retreat, festival, convention). Do not repeat opportunities that are already known/listed. Only propose an opportunity if there's a real, stated reason for it in the findings or organization context — do not invent an event that isn't evidenced. If one or more opportunities are already known, be conservative: only add a new one if it is clearly a separate, distinctly-named recurring program or event, not a rewording of something already listed.`;

export async function runDetectOpportunitiesStage(
  org: Organization,
  pipelineRunId: string
): Promise<{ output: DetectOpportunitiesStageOutput; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  const existing = await listOpportunitiesForOrganization(org.id);
  const activeExisting = existing.filter((o) => o.status !== "rejected" && o.status !== "duplicate");
  if (activeExisting.length >= MAX_OPPORTUNITIES_PER_ORGANIZATION) {
    return {
      output: {
        existingCount: existing.length,
        createdCount: 0,
        opportunityIds: existing.map((o) => o.id),
        skippedReason: `Already at the ${MAX_OPPORTUNITIES_PER_ORGANIZATION}-opportunity cap for this organization.`,
      },
    };
  }

  const [findings, opportunityTypes] = await Promise.all([listFindingsForOrganization(org.id), listOpportunityTypes()]);

  const indexed = indexFindingsForPrompt(findings);
  const userContent = [
    `Organization: ${org.name}`,
    `Already known opportunities: ${existing.length > 0 ? existing.map((o) => o.title).join("; ") : "none"}`,
    `Findings:\n${indexed.promptText}`,
    `Allowed opportunity types: ${opportunityTypes.map((t) => t.key).join(", ")}`,
  ].join("\n\n");

  const result = await callStructured({
    schema: buildOpportunityDetectionSchema(opportunityTypes.map((t) => t.key)),
    schemaName: "opportunity_detection",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
  });

  let createdCount = 0;
  const opportunityIds: string[] = existing.map((o) => o.id);
  let activeCount = activeExisting.length;

  for (const proposed of result.parsed.opportunities) {
    if (activeCount >= MAX_OPPORTUNITIES_PER_ORGANIZATION) break;
    const alreadyExists = await findExistingOpportunityByTitle(org.id, proposed.title);
    if (alreadyExists) continue;
    const type = await findOpportunityTypeByKey(proposed.opportunityTypeKey);
    const created: Opportunity = await createOpportunity({
      organizationId: org.id,
      opportunityTypeId: type?.id ?? null,
      title: proposed.title,
      eventOrInitiativeName: proposed.eventOrInitiativeName,
      eventDateEstimate: proposed.eventDateEstimate,
      eventDateConfidence: proposed.eventDateConfidence,
      description: proposed.description,
      status: "researching",
    });
    // supportingFindingIndexes are resolved to real finding ids for provenance in agent_runs.output only —
    // opportunities don't have their own "supporting findings" column; findings stay linked via organization_id.
    void resolveFindingIds(indexed, proposed.supportingFindingIndexes);
    opportunityIds.push(created.id);
    createdCount += 1;
    activeCount += 1;
  }

  return {
    output: { existingCount: existing.length, createdCount, opportunityIds },
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: result.costUsd,
  };
}
