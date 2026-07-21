import { callStructured } from "../../openai/client";
import { ScoringResultSchema } from "../../openai/schemas";
import { listFindingsWithSourcesForOpportunity } from "../../db/research";
import { listContactsForOrganization } from "../../db/contacts";
import { createProspectScore } from "../../db/scores";
import { computeTotalScore } from "../../scoring/score";
import { SCORE_COMPONENT_KEYS, type ScoreComponent, type ScoreComponentKey } from "../../types";
import { indexFindingsForPrompt, resolveFindingIds } from "../context";
import type { Organization, Opportunity } from "../../types";

export type ScoreStageOutput = {
  prospectScoreId: string;
  totalScore: number;
  confidence: string;
};

const SYSTEM_PROMPT = `Score how promising this prospect is for a company that sells participatory choir/anthem live-audience experiences, across each required component (0-10). Base every score and rationale ONLY on the findings provided — cite the finding numbers that support each component. If a component has no supporting findings, score conservatively (low-to-mid) and say so in the rationale rather than guessing high. List anything important that's still missing.`;

export async function runScoreStage(
  org: Organization,
  opportunity: Opportunity,
  pipelineRunId: string
): Promise<{ output: ScoreStageOutput; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  const [findings, contacts] = await Promise.all([
    listFindingsWithSourcesForOpportunity(org.id, opportunity.id),
    listContactsForOrganization(org.id),
  ]);
  const indexed = indexFindingsForPrompt(findings);

  const contactSummary =
    contacts.length === 0
      ? "No contacts identified yet."
      : contacts
          .map((c) => `${c.fullName ?? "Unnamed"} — ${c.roleTitle ?? "unknown role"} (email status: ${c.emailVerificationStatus})`)
          .join("; ");

  const userContent = [
    `Organization: ${org.name}`,
    `Opportunity: ${opportunity.title}${opportunity.eventOrInitiativeName ? ` (${opportunity.eventOrInitiativeName})` : ""}`,
    opportunity.description ? `Description: ${opportunity.description}` : null,
    `Contacts: ${contactSummary}`,
    `Findings:\n${indexed.promptText}`,
    `Required components (score each 0-10): ${SCORE_COMPONENT_KEYS.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await callStructured({
    schema: ScoringResultSchema,
    schemaName: "scoring_result",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
  });

  const componentScoresForCompute = {} as Record<ScoreComponentKey, Omit<ScoreComponent, "weight">>;
  for (const key of SCORE_COMPONENT_KEYS) {
    const c = result.parsed.components[key];
    componentScoresForCompute[key] = {
      score: c.score,
      rationale: c.rationale,
      findingIds: resolveFindingIds(indexed, c.supportingFindingIndexes),
    };
  }
  const { total, components } = computeTotalScore(componentScoresForCompute);

  const overallRationale = `Weighted total ${total}/100 (confidence: ${result.parsed.overallConfidence}). ` +
    SCORE_COMPONENT_KEYS.map((k) => `${k}: ${components[k].score}/10`).join(", ") + ".";

  const score = await createProspectScore({
    opportunityId: opportunity.id,
    pipelineRunId,
    totalScore: total,
    componentScores: components,
    rationale: overallRationale,
    confidence: result.parsed.overallConfidence,
    missingInformation: result.parsed.missingInformation,
    model: result.model,
  });

  return {
    output: { prospectScoreId: score.id, totalScore: total, confidence: result.parsed.overallConfidence },
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: result.costUsd,
  };
}
