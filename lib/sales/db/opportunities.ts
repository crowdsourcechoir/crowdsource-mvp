import { requireSupabaseAdmin } from "./client";
import type { Opportunity, OpportunityStatus, RelationshipStage } from "../types";

function rowToOpportunity(row: Record<string, unknown>): Opportunity {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    opportunityTypeId: (row.opportunity_type_id as string | null) ?? null,
    title: row.title as string,
    eventOrInitiativeName: (row.event_or_initiative_name as string | null) ?? null,
    eventDateEstimate: (row.event_date_estimate as string | null) ?? null,
    eventDateConfidence: (row.event_date_confidence as Opportunity["eventDateConfidence"]) ?? null,
    eventWebsiteUrl: (row.event_website_url as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    status: (row.status as OpportunityStatus) ?? "new",
    targetContactRoleHint: (row.target_contact_role_hint as string | null) ?? null,
    relationshipStage: (row.relationship_stage as RelationshipStage | null) ?? null,
    stageUpdatedAt: (row.stage_updated_at as string | null) ?? null,
    importMetadata: (row.import_metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export type CreateOpportunityInput = {
  organizationId: string;
  opportunityTypeId?: string | null;
  title: string;
  eventOrInitiativeName?: string | null;
  eventDateEstimate?: string | null;
  eventDateConfidence?: Opportunity["eventDateConfidence"];
  eventWebsiteUrl?: string | null;
  description?: string | null;
  status?: OpportunityStatus;
  targetContactRoleHint?: string | null;
  importMetadata?: Record<string, unknown> | null;
};

export async function listOpportunitiesForOrganization(organizationId: string): Promise<Opportunity[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOpportunity);
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("opportunities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToOpportunity(data) : null;
}

export async function findExistingOpportunityByTitle(organizationId: string, title: string): Promise<Opportunity | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("*")
    .eq("organization_id", organizationId)
    .ilike("title", title)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToOpportunity(data) : null;
}

export async function createOpportunity(input: CreateOpportunityInput): Promise<Opportunity> {
  const db = requireSupabaseAdmin();
  const row = {
    organization_id: input.organizationId,
    opportunity_type_id: input.opportunityTypeId ?? null,
    title: input.title,
    event_or_initiative_name: input.eventOrInitiativeName ?? null,
    event_date_estimate: input.eventDateEstimate ?? null,
    event_date_confidence: input.eventDateConfidence ?? null,
    event_website_url: input.eventWebsiteUrl ?? null,
    description: input.description ?? null,
    status: input.status ?? "new",
    target_contact_role_hint: input.targetContactRoleHint ?? null,
    import_metadata: input.importMetadata ?? null,
  };
  const { data, error } = await db.from("opportunities").insert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToOpportunity(data);
}

export async function updateOpportunityStatus(id: string, status: OpportunityStatus): Promise<Opportunity> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToOpportunity(data);
}

/** The opportunities visible on /admin/sales/funnel — anything the funnel has an opinion about
 * yet, i.e. approved/launched at least once. Ordered oldest-stage-change-first so a "needs
 * attention" item that's been sitting doesn't get buried below ones just moved. */
export async function listOpportunitiesInFunnel(): Promise<Opportunity[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("*")
    .not("relationship_stage", "is", null)
    .order("stage_updated_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOpportunity);
}

/**
 * Moves an opportunity to a new funnel stage (or into the terminal `lost` bucket), bumping
 * `stage_updated_at` to now. Backward moves (e.g. Purchase → Interest) are allowed on purpose —
 * this is a human correcting the record, not a one-way pipeline stage.
 */
export async function updateOpportunityRelationshipStage(id: string, stage: RelationshipStage): Promise<Opportunity> {
  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("opportunities")
    .update({ relationship_stage: stage, stage_updated_at: now, updated_at: now })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToOpportunity(data);
}
