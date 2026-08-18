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
    description: (row.description as string | null) ?? null,
    status: (row.status as OpportunityStatus) ?? "new",
    targetContactRoleHint: (row.target_contact_role_hint as string | null) ?? null,
    relationshipStage: (row.relationship_stage as RelationshipStage | null) ?? null,
    stageUpdatedAt: (row.stage_updated_at as string | null) ?? null,
    gmailThreadId: (row.gmail_thread_id as string | null) ?? null,
    lastOutboundAt: (row.last_outbound_at as string | null) ?? null,
    lastInboundAt: (row.last_inbound_at as string | null) ?? null,
    nextFollowUpAt: (row.next_follow_up_at as string | null) ?? null,
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
 * `stage_updated_at` to now. Backward moves (e.g. Won → Interest) are allowed on purpose —
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

export async function updateOpportunityTouchTimestamps(
  id: string,
  input: {
    lastOutboundAt?: string | null;
    lastInboundAt?: string | null;
    nextFollowUpAt?: string | null;
    gmailThreadId?: string | null;
  }
): Promise<Opportunity> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.lastOutboundAt !== undefined) row.last_outbound_at = input.lastOutboundAt;
  if (input.lastInboundAt !== undefined) row.last_inbound_at = input.lastInboundAt;
  if (input.nextFollowUpAt !== undefined) row.next_follow_up_at = input.nextFollowUpAt;
  if (input.gmailThreadId !== undefined) row.gmail_thread_id = input.gmailThreadId;
  const { data, error } = await db.from("opportunities").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToOpportunity(data);
}

/** Opportunities due for an AI nudge draft (no pending nudge yet — enforced by caller). */
export async function listOpportunitiesDueForNudge(nowIso: string = new Date().toISOString()): Promise<Opportunity[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("*")
    .lte("next_follow_up_at", nowIso)
    .in("relationship_stage", ["awareness", "interest"])
    .order("next_follow_up_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(rowToOpportunity)
    .filter((opp) => {
      // No inbound since last outbound (or never inbound).
      if (!opp.lastOutboundAt) return false;
      if (!opp.lastInboundAt) return true;
      return new Date(opp.lastInboundAt).getTime() < new Date(opp.lastOutboundAt).getTime();
    });
}
