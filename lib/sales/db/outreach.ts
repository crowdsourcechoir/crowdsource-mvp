import { requireSupabaseAdmin } from "./client";
import type { OutreachDraft, OutreachDraftKind, OutreachDraftStatus, OutreachTemplate } from "../types";

function rowToTemplate(row: Record<string, unknown>): OutreachTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    opportunityTypeId: (row.opportunity_type_id as string | null) ?? null,
    industrySegmentId: (row.industry_segment_id as string | null) ?? null,
    bodyTemplate: row.body_template as string,
    status: row.status as OutreachTemplate["status"],
  };
}

function rowToDraft(row: Record<string, unknown>): OutreachDraft {
  return {
    id: row.id as string,
    opportunityId: row.opportunity_id as string,
    contactId: (row.contact_id as string | null) ?? null,
    pipelineRunId: (row.pipeline_run_id as string | null) ?? null,
    templateId: (row.template_id as string | null) ?? null,
    kind: ((row.kind as OutreachDraftKind | null) ?? "initial") as OutreachDraftKind,
    aiSubject: row.ai_subject as string,
    aiBody: row.ai_body as string,
    editedSubject: (row.edited_subject as string | null) ?? null,
    editedBody: (row.edited_body as string | null) ?? null,
    qaFlags: (row.qa_flags as OutreachDraft["qaFlags"]) ?? null,
    status: row.status as OutreachDraftStatus,
    confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Picks the best approved template, matching two independent dimensions that compose rather than
 * replace each other — see supabase/sales-platform-add-industry-segment-override.sql:
 *   1. opportunityTypeId, if given (unchanged from before this dimension existed — no current
 *      template sets this non-null, but the matching stays intact for whenever one does).
 *   2. industrySegmentId, if given and no opportunity-type match was found — e.g. the
 *      'Educational — v1 default' template, matched by the organization's *resolved* segment
 *      (org override else its organization_type's segment; see
 *      lib/sales/db/lookups.ts#resolveIndustrySegmentIdForOrganization).
 *   3. The fully generic fallback (both dimensions null) — same template as always if neither
 *      more specific match exists.
 */
export async function findApprovedTemplate(
  opportunityTypeId: string | null,
  industrySegmentId?: string | null
): Promise<OutreachTemplate | null> {
  const db = requireSupabaseAdmin();
  if (opportunityTypeId) {
    const { data, error } = await db
      .from("outreach_templates")
      .select("*")
      .eq("status", "approved")
      .eq("opportunity_type_id", opportunityTypeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return rowToTemplate(data);
  }
  if (industrySegmentId) {
    const { data, error } = await db
      .from("outreach_templates")
      .select("*")
      .eq("status", "approved")
      .eq("industry_segment_id", industrySegmentId)
      .is("opportunity_type_id", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return rowToTemplate(data);
  }
  const { data, error } = await db
    .from("outreach_templates")
    .select("*")
    .eq("status", "approved")
    .is("opportunity_type_id", null)
    .is("industry_segment_id", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToTemplate(data) : null;
}

export async function createOutreachDraft(input: {
  opportunityId: string;
  contactId?: string | null;
  pipelineRunId?: string | null;
  templateId?: string | null;
  kind?: OutreachDraftKind;
  aiSubject: string;
  aiBody: string;
  status?: OutreachDraftStatus;
  confidenceScore?: number | null;
}): Promise<OutreachDraft> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_drafts")
    .insert({
      opportunity_id: input.opportunityId,
      contact_id: input.contactId ?? null,
      pipeline_run_id: input.pipelineRunId ?? null,
      template_id: input.templateId ?? null,
      kind: input.kind ?? "initial",
      ai_subject: input.aiSubject,
      ai_body: input.aiBody,
      status: input.status ?? "draft",
      confidence_score: input.confidenceScore ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToDraft(data);
}

export async function listDraftsForOpportunity(opportunityId: string): Promise<OutreachDraft[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_drafts")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToDraft);
}

export async function updateDraftQa(id: string, status: OutreachDraftStatus, qaFlags: OutreachDraft["qaFlags"]): Promise<OutreachDraft> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_drafts")
    .update({ status, qa_flags: qaFlags as never, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToDraft(data);
}

export async function updateDraftDecision(
  id: string,
  input: { status: OutreachDraftStatus; editedSubject?: string | null; editedBody?: string | null }
): Promise<OutreachDraft> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
  if (input.editedSubject !== undefined) row.edited_subject = input.editedSubject;
  if (input.editedBody !== undefined) row.edited_body = input.editedBody;
  const { data, error } = await db.from("outreach_drafts").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToDraft(data);
}

/** Persist human edits without approving or changing draft status. */
export async function updateDraftEdits(
  id: string,
  input: { editedSubject: string; editedBody: string }
): Promise<OutreachDraft> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_drafts")
    .update({
      edited_subject: input.editedSubject,
      edited_body: input.editedBody,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToDraft(data);
}

export async function getDraft(id: string): Promise<OutreachDraft | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("outreach_drafts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToDraft(data) : null;
}
