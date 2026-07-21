import { requireSupabaseAdmin } from "./client";
import type { ProspectScore, ScoreComponentKey, ScoreComponent } from "../types";

function rowToScore(row: Record<string, unknown>): ProspectScore {
  return {
    id: row.id as string,
    opportunityId: row.opportunity_id as string,
    pipelineRunId: row.pipeline_run_id as string,
    totalScore: Number(row.total_score),
    componentScores: row.component_scores as Record<ScoreComponentKey, ScoreComponent>,
    rationale: row.rationale as string,
    confidence: row.confidence as ProspectScore["confidence"],
    missingInformation: (row.missing_information as string[]) ?? [],
    model: (row.model as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createProspectScore(input: {
  opportunityId: string;
  pipelineRunId: string;
  totalScore: number;
  componentScores: Record<ScoreComponentKey, ScoreComponent>;
  rationale: string;
  confidence: ProspectScore["confidence"];
  missingInformation: string[];
  model?: string;
}): Promise<ProspectScore> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("prospect_scores")
    .insert({
      opportunity_id: input.opportunityId,
      pipeline_run_id: input.pipelineRunId,
      total_score: input.totalScore,
      component_scores: input.componentScores as never,
      rationale: input.rationale,
      confidence: input.confidence,
      missing_information: input.missingInformation,
      model: input.model ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToScore(data);
}

export async function getLatestScoreForOpportunity(opportunityId: string): Promise<ProspectScore | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("prospect_scores")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToScore(data) : null;
}
