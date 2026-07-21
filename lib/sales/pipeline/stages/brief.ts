import { callStructured } from "../../openai/client";
import { BriefResultSchema } from "../../openai/schemas";
import { listFindingsWithSourcesForOpportunity } from "../../db/research";
import { indexFindingsForPrompt, resolveFindingIds } from "../context";
import type { Organization, Opportunity, ProspectScore } from "../../types";

export type BriefStageOutput = {
  summary: string;
  recommendedAngle: string;
  risks: string[];
  keyFindingIds: string[];
};

const SYSTEM_PROMPT = `Write a short internal brief (not the outreach email) for a salesperson deciding whether to reach out. Be concise — this is read in about 15 seconds. Base it only on the given findings and score; do not add unstated facts.`;

export async function runBriefStage(
  org: Organization,
  opportunity: Opportunity,
  score: ProspectScore
): Promise<{ output: BriefStageOutput; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  const findings = await listFindingsWithSourcesForOpportunity(org.id, opportunity.id);
  const indexed = indexFindingsForPrompt(findings);

  const userContent = [
    `Organization: ${org.name}`,
    `Opportunity: ${opportunity.title}`,
    `Score: ${score.totalScore}/100 (confidence: ${score.confidence})`,
    `Missing information: ${score.missingInformation.join("; ") || "none noted"}`,
    `Findings:\n${indexed.promptText}`,
  ].join("\n\n");

  const result = await callStructured({
    schema: BriefResultSchema,
    schemaName: "brief_result",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
  });

  return {
    output: {
      summary: result.parsed.summary,
      recommendedAngle: result.parsed.recommendedAngle,
      risks: result.parsed.risks,
      keyFindingIds: resolveFindingIds(indexed, result.parsed.keyFindingIndexes),
    },
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: result.costUsd,
  };
}
