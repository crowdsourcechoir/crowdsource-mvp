import { requireSupabaseAdmin } from "./client";
import { getDigestMinScore } from "../digest/config";
import { DEEPEN_MIN_SCORE } from "../pipeline/stages/deepenResearch";

/**
 * Orgs blocked on the verified-contact gate whose latest score is already solid (or near-miss).
 * These never re-enter listUnprocessedOrganizations (they already have a pipeline_run), so cron
 * must explicitly reprocess them — otherwise high-scoring leads sit forever in awaiting_contact.
 *
 * Prefer score ≥ minLeadScore (default 70), then near-miss salvage band down to DEEPEN_MIN_SCORE.
 */
export async function listAwaitingContactOrganizationIds(
  limit: number,
  minLeadScore: number = getDigestMinScore()
): Promise<{ organizationId: string; score: number }[]> {
  if (limit <= 0) return [];
  const db = requireSupabaseAdmin();

  const { data: opps, error } = await db
    .from("opportunities")
    .select("id, organization_id")
    .eq("status", "awaiting_contact")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  if (!opps?.length) return [];

  const scored: { organizationId: string; score: number }[] = [];
  const seenOrg = new Set<string>();

  for (const opp of opps) {
    const organizationId = opp.organization_id as string;
    if (seenOrg.has(organizationId)) continue;

    const { data: scoreRow, error: scoreErr } = await db
      .from("prospect_scores")
      .select("total_score")
      .eq("opportunity_id", opp.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scoreErr) throw new Error(scoreErr.message);

    const score = typeof scoreRow?.total_score === "number" ? Number(scoreRow.total_score) : -1;
    if (score < DEEPEN_MIN_SCORE) continue;

    seenOrg.add(organizationId);
    scored.push({ organizationId, score });
  }

  scored.sort((a, b) => {
    // Solid leads (≥70) first, then by score desc.
    const aSolid = a.score >= minLeadScore ? 0 : 1;
    const bSolid = b.score >= minLeadScore ? 0 : 1;
    if (aSolid !== bSolid) return aSolid - bSolid;
    return b.score - a.score;
  });

  return scored.slice(0, limit);
}
