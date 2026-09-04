import { requireSupabaseAdmin } from "./client";
import type { RelationshipStage } from "../types";

export type DashboardWin = {
  id: string;
  name: string;
  updatedAt: string | null;
};

export type SalesDashboardBuckets = {
  pendingCount: number;
  orgCount: number;
  funnelCount: number;
  funnelByStage: Record<RelationshipStage, number>;
  wins: DashboardWin[];
};

const EMPTY_STAGES: Record<RelationshipStage, number> = {
  awareness: 0,
  interest: 0,
  purchase: 0,
  lost: 0,
};

export async function loadSalesDashboardBuckets(): Promise<SalesDashboardBuckets> {
  const db = requireSupabaseAdmin();
  const [pendingRes, orgRes, oppRes] = await Promise.all([
    db.from("approval_queue_items").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("organizations").select("id", { count: "exact", head: true }),
    db
      .from("opportunities")
      .select("id, organization_id, relationship_stage, stage_updated_at")
      .not("relationship_stage", "is", null),
  ]);

  if (pendingRes.error) throw new Error(pendingRes.error.message);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (oppRes.error) throw new Error(oppRes.error.message);

  const funnelByStage = { ...EMPTY_STAGES };
  const wonOpps: Array<{ id: string; organizationId: string; updatedAt: string | null }> = [];
  for (const row of oppRes.data ?? []) {
    const stage = row.relationship_stage as RelationshipStage | null;
    if (!stage || !(stage in funnelByStage)) continue;
    funnelByStage[stage] += 1;
    if (stage === "purchase") {
      wonOpps.push({
        id: String(row.id),
        organizationId: String(row.organization_id),
        updatedAt: typeof row.stage_updated_at === "string" ? row.stage_updated_at : null,
      });
    }
  }

  wonOpps.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const wonIds = Array.from(new Set(wonOpps.map((w) => w.organizationId)));
  const nameByOrgId = new Map<string, string>();
  if (wonIds.length > 0) {
    const { data, error } = await db.from("organizations").select("id, name").in("id", wonIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      nameByOrgId.set(String(row.id), String(row.name));
    }
  }

  return {
    pendingCount: pendingRes.count ?? 0,
    orgCount: orgRes.count ?? 0,
    funnelCount: (oppRes.data ?? []).length,
    funnelByStage,
    wins: wonOpps.map((w) => ({
      id: w.id,
      name: nameByOrgId.get(w.organizationId) ?? "Unknown org",
      updatedAt: w.updatedAt,
    })),
  };
}
