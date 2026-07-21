import { callStructured } from "../../openai/client";
import { buildOrganizationTypeGuessSchema } from "../../openai/schemas";
import { listOrganizationTypes } from "../../db/lookups";
import { updateOrganization } from "../../db/organizations";
import type { Organization } from "../../types";

export type NormalizeStageOutput = {
  alreadyTyped: boolean;
  organizationTypeKey: string | null;
  confidence: number | null;
  rationale: string | null;
};

const SYSTEM_PROMPT = `You classify organizations for a company that provides participatory choir/anthem experiences for live gatherings (conferences, corporate events, sports games, university events, festivals, etc).
Given an organization's name, website domain, and any hint category, choose the single best-fitting organization type from the allowed list. If genuinely unclear, pick "other" with low confidence rather than guessing confidently.`;

/** Stage 1: deterministic normalization already happened at creation (name/domain). This only classifies type when missing. */
export async function runNormalizeStage(org: Organization): Promise<{ output: NormalizeStageOutput; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  if (org.organizationTypeId) {
    return { output: { alreadyTyped: true, organizationTypeKey: null, confidence: null, rationale: "Already typed." } };
  }

  const types = await listOrganizationTypes();
  const hintCategory = (org.importMetadata as { category?: string } | null)?.category ?? null;
  const userContent = [
    `Organization name: ${org.name}`,
    org.domain ? `Website domain: ${org.domain}` : "Website domain: unknown",
    hintCategory ? `Hint category from source list: ${hintCategory}` : null,
    `Allowed organization types: ${types.map((t) => t.key).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callStructured({
    schema: buildOrganizationTypeGuessSchema(types.map((t) => t.key)),
    schemaName: "organization_type_guess",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
  });

  const matchedType = types.find((t) => t.key === result.parsed.organizationTypeKey);
  if (matchedType) {
    await updateOrganization(org.id, { organizationTypeId: matchedType.id });
  }

  return {
    output: {
      alreadyTyped: false,
      organizationTypeKey: result.parsed.organizationTypeKey,
      confidence: result.parsed.confidence,
      rationale: result.parsed.rationale,
    },
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: result.costUsd,
  };
}
