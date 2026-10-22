import { requireSupabaseAdmin } from "./client";
import type { RelationshipStage } from "../types";
import { loadSalesTodayTasks, type SalesTodaySnapshot } from "./follow-ups";
import { readDealEconomics, type DealEconomics } from "../engines";
import { isFollowUpDueOnOrBeforeToday } from "../follow-up/calendar";
import { matchesCashNow } from "../queue/cash-window";

export type DashboardWin = {
  id: string;
  name: string;
  updatedAt: string | null;
  bookedAmount: number | null;
  cashCollected: number | null;
  earnedAmount: number | null;
};

export type DealEconomicsTotals = {
  bookedAmount: number;
  cashCollected: number;
  earnedAmount: number;
};

export type SalesDashboardBuckets = {
  pendingCount: number;
  orgCount: number;
  funnelCount: number;
  funnelByStage: Record<RelationshipStage, number>;
  wins: DashboardWin[];
  today: SalesTodaySnapshot;
  /** Sums across Won (purchase) opportunities. */
  dealTotals: DealEconomicsTotals;
  /** Opportunities in the funnel matching cash-now heuristics. */
  cashNowCount: number;
};

const EMPTY_STAGES: Record<RelationshipStage, number> = {
  awareness: 0,
  interest: 0,
  purchase: 0,
  lost: 0,
};

const EMPTY_TODAY: SalesTodaySnapshot = { dueCount: 0, overdueCount: 0, repliedCount: 0, tasks: [] };

export async function loadSalesDashboardBuckets(): Promise<SalesDashboardBuckets> {
  const db = requireSupabaseAdmin();
  const [pendingRes, orgRes, oppRes, todaySettled] = await Promise.all([
    db.from("approval_queue_items").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("organizations").select("id", { count: "exact", head: true }),
    db
      .from("opportunities")
      .select(
        "id, organization_id, relationship_stage, stage_updated_at, event_date_estimate, next_follow_up_at, last_inbound_at, import_metadata"
      )
      .not("relationship_stage", "is", null),
    loadSalesTodayTasks().catch(() => EMPTY_TODAY),
  ]);

  if (pendingRes.error) throw new Error(pendingRes.error.message);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (oppRes.error) throw new Error(oppRes.error.message);

  const funnelByStage = { ...EMPTY_STAGES };
  const wonOpps: Array<{
    id: string;
    organizationId: string;
    updatedAt: string | null;
    economics: DealEconomics;
  }> = [];
  let cashNowCount = 0;
  const dealTotals: DealEconomicsTotals = { bookedAmount: 0, cashCollected: 0, earnedAmount: 0 };

  for (const row of oppRes.data ?? []) {
    const stage = row.relationship_stage as RelationshipStage | null;
    if (!stage || !(stage in funnelByStage)) continue;
    funnelByStage[stage] += 1;

    const nextFollowUpAt =
      typeof row.next_follow_up_at === "string" ? row.next_follow_up_at : null;
    const followUpDue =
      isFollowUpDueOnOrBeforeToday(nextFollowUpAt) || Boolean(row.last_inbound_at && !nextFollowUpAt);
    if (
      matchesCashNow({
        eventDateEstimate: typeof row.event_date_estimate === "string" ? row.event_date_estimate : null,
        relationshipStage: stage,
        followUpDue,
      })
    ) {
      cashNowCount += 1;
    }

    if (stage === "purchase") {
      const economics = readDealEconomics(row.import_metadata);
      if (economics.bookedAmount != null) dealTotals.bookedAmount += economics.bookedAmount;
      if (economics.cashCollected != null) dealTotals.cashCollected += economics.cashCollected;
      if (economics.earnedAmount != null) dealTotals.earnedAmount += economics.earnedAmount;
      wonOpps.push({
        id: String(row.id),
        organizationId: String(row.organization_id),
        updatedAt: typeof row.stage_updated_at === "string" ? row.stage_updated_at : null,
        economics,
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
      bookedAmount: w.economics.bookedAmount,
      cashCollected: w.economics.cashCollected,
      earnedAmount: w.economics.earnedAmount,
    })),
    today: todaySettled ?? EMPTY_TODAY,
    dealTotals,
    cashNowCount,
  };
}
