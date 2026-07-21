import { requireSupabaseAdmin } from "./client";
import type { ResearchFinding, ResearchSource } from "../types";

function rowToSource(row: Record<string, unknown>): ResearchSource {
  return {
    id: row.id as string,
    pipelineRunId: row.pipeline_run_id as string,
    url: row.url as string,
    title: (row.title as string | null) ?? null,
    fetchedAt: row.fetched_at as string,
    contentHash: (row.content_hash as string | null) ?? null,
    rawExcerpt: (row.raw_excerpt as string | null) ?? null,
    retrievalStatus: (row.retrieval_status as ResearchSource["retrievalStatus"]) ?? "ok",
  };
}

function rowToFinding(row: Record<string, unknown>): ResearchFinding {
  return {
    id: row.id as string,
    pipelineRunId: row.pipeline_run_id as string,
    organizationId: row.organization_id as string,
    opportunityId: (row.opportunity_id as string | null) ?? null,
    sourceId: row.source_id as string,
    claimType: row.claim_type as string,
    claimText: row.claim_text as string,
    claimValue: row.claim_value,
    confidence: (row.confidence as number | null) ?? null,
    origin: (row.origin as ResearchFinding["origin"]) ?? "ai_research",
    createdAt: row.created_at as string,
  };
}

export async function createResearchSource(input: {
  pipelineRunId: string;
  url: string;
  title?: string | null;
  fetchedAt?: string;
  contentHash?: string | null;
  rawExcerpt?: string | null;
  retrievalStatus?: ResearchSource["retrievalStatus"];
}): Promise<ResearchSource> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("research_sources")
    .insert({
      pipeline_run_id: input.pipelineRunId,
      url: input.url,
      title: input.title ?? null,
      fetched_at: input.fetchedAt ?? new Date().toISOString(),
      content_hash: input.contentHash ?? null,
      raw_excerpt: input.rawExcerpt ?? null,
      retrieval_status: input.retrievalStatus ?? "ok",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToSource(data);
}

export async function createResearchFinding(input: {
  pipelineRunId: string;
  organizationId: string;
  opportunityId?: string | null;
  sourceId: string;
  claimType: string;
  claimText: string;
  claimValue?: unknown;
  confidence?: number | null;
  origin?: ResearchFinding["origin"];
}): Promise<ResearchFinding> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("research_findings")
    .insert({
      pipeline_run_id: input.pipelineRunId,
      organization_id: input.organizationId,
      opportunity_id: input.opportunityId ?? null,
      source_id: input.sourceId,
      claim_type: input.claimType,
      claim_text: input.claimText,
      claim_value: (input.claimValue ?? null) as never,
      confidence: input.confidence ?? null,
      origin: input.origin ?? "ai_research",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToFinding(data);
}

export async function listFindingsForOrganization(organizationId: string): Promise<ResearchFinding[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("research_findings")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToFinding);
}

export async function listFindingsWithSourcesForOpportunity(
  organizationId: string,
  opportunityId: string
): Promise<(ResearchFinding & { sourceUrl: string })[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("research_findings")
    .select("*, research_sources(url)")
    .eq("organization_id", organizationId)
    .or(`opportunity_id.eq.${opportunityId},opportunity_id.is.null`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...rowToFinding(row),
    sourceUrl: ((row as Record<string, unknown>).research_sources as { url?: string } | null)?.url ?? "",
  }));
}

export async function getSource(id: string): Promise<ResearchSource | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("research_sources").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToSource(data) : null;
}
