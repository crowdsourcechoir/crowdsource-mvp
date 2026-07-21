import { z } from "zod";
import { SCORE_COMPONENT_KEYS } from "../types";

/** zod requires a non-empty tuple for z.enum; lookup tables are always seeded with at least one row. */
function keyEnum(keys: string[]) {
  if (keys.length === 0) throw new Error("keyEnum requires at least one key.");
  return z.enum(keys as [string, ...string[]]);
}

export function buildOrganizationTypeGuessSchema(typeKeys: string[]) {
  return z.object({
    organizationTypeKey: keyEnum(typeKeys),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
  });
}
export type OrganizationTypeGuess = z.infer<ReturnType<typeof buildOrganizationTypeGuessSchema>>;

export const PageFindingsSchema = z.object({
  findings: z.array(
    z.object({
      claimType: z.enum([
        "audience_size",
        "event_date",
        "decision_maker",
        "budget_signal",
        "program_fit_signal",
        "other",
      ]),
      claimText: z.string(),
      claimValueText: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    })
  ),
  namedPeopleMentioned: z.array(
    z.object({
      fullName: z.string(),
      roleTitle: z.string().nullable(),
      email: z.string().nullable(),
    })
  ),
});
export type PageFindings = z.infer<typeof PageFindingsSchema>;

export function buildOpportunityDetectionSchema(opportunityTypeKeys: string[]) {
  return z.object({
    opportunities: z.array(
      z.object({
        opportunityTypeKey: keyEnum(opportunityTypeKeys),
        title: z.string(),
        eventOrInitiativeName: z.string().nullable(),
        eventDateEstimate: z.string().nullable(),
        eventDateConfidence: z.enum(["confirmed", "estimated", "unknown"]),
        description: z.string(),
        supportingFindingIndexes: z.array(z.number().int()),
      })
    ),
  });
}
export type OpportunityDetectionResult = z.infer<ReturnType<typeof buildOpportunityDetectionSchema>>;

const scoreComponentSchema = z.object({
  score: z.number().min(0).max(10),
  rationale: z.string(),
  supportingFindingIndexes: z.array(z.number().int()),
});

export const ScoringResultSchema = z.object({
  components: z.object(
    Object.fromEntries(SCORE_COMPONENT_KEYS.map((key) => [key, scoreComponentSchema])) as Record<
      (typeof SCORE_COMPONENT_KEYS)[number],
      typeof scoreComponentSchema
    >
  ),
  overallConfidence: z.enum(["low", "medium", "high"]),
  missingInformation: z.array(z.string()),
});
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

export const BriefResultSchema = z.object({
  summary: z.string(),
  recommendedAngle: z.string(),
  risks: z.array(z.string()),
  keyFindingIndexes: z.array(z.number().int()),
});
export type BriefResult = z.infer<typeof BriefResultSchema>;

export const DraftFillSchema = z.object({
  subject: z.string(),
  openingReason: z.string(),
  fitReason: z.string(),
  personalizationFindingIndexes: z.array(z.number().int()),
});
export type DraftFill = z.infer<typeof DraftFillSchema>;

export const DiscoveryCandidatesSchema = z.object({
  candidates: z.array(
    z.object({
      organizationName: z.string(),
      websiteUrl: z.string().nullable(),
      rationale: z.string(),
      sourceUrl: z.string(),
    })
  ),
});
export type DiscoveryCandidates = z.infer<typeof DiscoveryCandidatesSchema>;

export const QaResultSchema = z.object({
  passed: z.boolean(),
  flags: z.array(
    z.object({
      type: z.enum([
        "fabricated_familiarity",
        "unsupported_claim",
        "excessive_flattery",
        "generic_description",
        "fake_personalization",
        "sensitive_info",
        "unexplained_fit_claim",
        "other",
      ]),
      detail: z.string(),
    })
  ),
});
export type QaResult = z.infer<typeof QaResultSchema>;
