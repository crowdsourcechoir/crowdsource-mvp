import { requireSupabaseAdmin } from "./client";
import type { OutreachFeedback, OutreachFeedbackDecision } from "../types";

function rowToFeedback(row: Record<string, unknown>): OutreachFeedback {
  return {
    id: row.id as string,
    opportunityId: row.opportunity_id as string,
    outreachDraftId: (row.outreach_draft_id as string | null) ?? null,
    contactId: (row.contact_id as string | null) ?? null,
    opportunityTypeId: (row.opportunity_type_id as string | null) ?? null,
    industrySegmentId: (row.industry_segment_id as string | null) ?? null,
    outreachPersona: (row.outreach_persona as string | null) ?? null,
    decision: row.decision as OutreachFeedbackDecision,
    originalSubject: row.original_subject as string,
    originalBody: row.original_body as string,
    editedSubject: (row.edited_subject as string | null) ?? null,
    editedBody: (row.edited_body as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createOutreachFeedback(input: {
  opportunityId: string;
  outreachDraftId?: string | null;
  contactId?: string | null;
  opportunityTypeId?: string | null;
  industrySegmentId?: string | null;
  outreachPersona?: string | null;
  decision: OutreachFeedbackDecision;
  originalSubject: string;
  originalBody: string;
  editedSubject?: string | null;
  editedBody?: string | null;
  rejectionReason?: string | null;
}): Promise<OutreachFeedback> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_feedback")
    .insert({
      opportunity_id: input.opportunityId,
      outreach_draft_id: input.outreachDraftId ?? null,
      contact_id: input.contactId ?? null,
      opportunity_type_id: input.opportunityTypeId ?? null,
      industry_segment_id: input.industrySegmentId ?? null,
      outreach_persona: input.outreachPersona ?? null,
      decision: input.decision,
      original_subject: input.originalSubject,
      original_body: input.originalBody,
      edited_subject: input.editedSubject ?? null,
      edited_body: input.editedBody ?? null,
      rejection_reason: input.rejectionReason ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToFeedback(data);
}

/** Recent accepted edits for few-shot guidance in draft/nudge prompts. */
export async function listRecentAcceptedEditFeedback(input: {
  outreachPersona?: string | null;
  industrySegmentId?: string | null;
  limit?: number;
}): Promise<OutreachFeedback[]> {
  const db = requireSupabaseAdmin();
  let query = db
    .from("outreach_feedback")
    .select("*")
    .eq("decision", "approved_with_edits")
    .not("edited_body", "is", null)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 5);

  if (input.outreachPersona) query = query.eq("outreach_persona", input.outreachPersona);
  if (input.industrySegmentId) query = query.eq("industry_segment_id", input.industrySegmentId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(rowToFeedback);
  if (rows.length > 0 || (!input.outreachPersona && !input.industrySegmentId)) return rows;

  // Fall back to any recent edits if the persona/segment slice is empty.
  const { data: fallback, error: fbErr } = await db
    .from("outreach_feedback")
    .select("*")
    .eq("decision", "approved_with_edits")
    .not("edited_body", "is", null)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 5);
  if (fbErr) throw new Error(fbErr.message);
  return (fallback ?? []).map(rowToFeedback);
}

/** Rough 0–1 confidence: how little humans have been editing similar drafts recently. */
export function estimateDraftConfidence(feedback: OutreachFeedback[]): number {
  if (feedback.length === 0) return 0.55;
  const ratios = feedback.map((f) => {
    const original = f.originalBody;
    const edited = f.editedBody ?? f.originalBody;
    if (!original.length) return 0.5;
    const distance = levenshteinRatio(original, edited);
    return 1 - distance;
  });
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.max(0.2, Math.min(0.95, avg));
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  // Cap cost: only compare first 2k chars.
  const left = a.slice(0, 2000);
  const right = b.slice(0, 2000);
  const m = left.length;
  const n = right.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n] / Math.max(m, n, 1);
}

export function formatFeedbackFewShots(feedback: OutreachFeedback[]): string {
  if (feedback.length === 0) return "";
  const blocks = feedback.slice(0, 3).map((f, i) => {
    return `--- ACCEPTED EDIT ${i + 1} ---
ORIGINAL SUBJECT: ${f.originalSubject}
EDITED SUBJECT: ${f.editedSubject ?? f.originalSubject}
ORIGINAL BODY:
${f.originalBody}

EDITED BODY:
${f.editedBody ?? f.originalBody}`;
  });
  return `The operator has recently edited drafts like these — prefer the EDITED voice/structure when filling fields:\n\n${blocks.join("\n\n")}`;
}
