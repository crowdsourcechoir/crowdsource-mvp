import { requireSupabaseAdmin } from "./client";
import type { RelationshipStage } from "../types";
import { loadSalesTodayTasks, type SalesTodaySnapshot } from "./follow-ups";
import {
  readDealEconomics,
  readDealForecast,
  readFlagshipOffer,
  readRevenueEngine,
  type DealEconomics,
} from "../engines";
import { isFollowUpDueOnOrBeforeToday } from "../follow-up/calendar";
import { matchesCashNow } from "../queue/cash-window";
import { readSalesInitiative } from "../initiatives";
import {
  PLAYBOOK,
  WORKSTREAM_KEYS,
  WORKSTREAMS,
  classifyWorkstream,
  isQualifiedBuyer,
  type WorkstreamKey,
} from "../strategy/playbook";

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

export type WorkstreamLaneStats = {
  key: WorkstreamKey;
  label: string;
  shortLabel: string;
  effortPct: number;
  annualTargetUsd: number;
  action: string;
  funnelCount: number;
  cashNowCount: number;
  qualifiedCount: number;
  interestCount: number;
  potentialUsd: number;
  queueHref: string;
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
  /** Playbook workload lanes — directs next work. */
  workstreams: WorkstreamLaneStats[];
  bookingRule: string;
  operatingRule: string;
};

const EMPTY_STAGES: Record<RelationshipStage, number> = {
  awareness: 0,
  interest: 0,
  purchase: 0,
  lost: 0,
};

const EMPTY_TODAY: SalesTodaySnapshot = { dueCount: 0, overdueCount: 0, repliedCount: 0, tasks: [] };

function emptyLane(key: WorkstreamKey): WorkstreamLaneStats {
  const ws = WORKSTREAMS[key];
  return {
    key,
    label: ws.label,
    shortLabel: ws.shortLabel,
    effortPct: ws.effortPct,
    annualTargetUsd: ws.annualTargetUsd,
    action: ws.action,
    funnelCount: 0,
    cashNowCount: 0,
    qualifiedCount: 0,
    interestCount: 0,
    potentialUsd: 0,
    queueHref: `/admin/sales/queue?workstream=${key}&cash=now&scope=all`,
  };
}

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

  const oppRows = oppRes.data ?? [];
  const orgIds = Array.from(new Set(oppRows.map((r) => String(r.organization_id))));
  const orgMetaById = new Map<string, { import_metadata: Record<string, unknown> | null; organization_type_id: string | null }>();
  const orgTypeKeyById = new Map<string, string>();

  if (orgIds.length > 0) {
    const { data: orgs, error: orgErr } = await db
      .from("organizations")
      .select("id, import_metadata, organization_type_id")
      .in("id", orgIds);
    if (orgErr) throw new Error(orgErr.message);
    for (const row of orgs ?? []) {
      orgMetaById.set(String(row.id), {
        import_metadata: (row.import_metadata as Record<string, unknown> | null) ?? null,
        organization_type_id: (row.organization_type_id as string | null) ?? null,
      });
    }
    const typeIds = Array.from(
      new Set(
        Array.from(orgMetaById.values())
          .map((o) => o.organization_type_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (typeIds.length > 0) {
      const { data: types, error: typeErr } = await db
        .from("organization_types")
        .select("id, key")
        .in("id", typeIds);
      if (typeErr) throw new Error(typeErr.message);
      for (const row of types ?? []) {
        orgTypeKeyById.set(String(row.id), String(row.key));
      }
    }
  }

  const funnelByStage = { ...EMPTY_STAGES };
  const wonOpps: Array<{
    id: string;
    organizationId: string;
    updatedAt: string | null;
    economics: DealEconomics;
  }> = [];
  let cashNowCount = 0;
  const dealTotals: DealEconomicsTotals = { bookedAmount: 0, cashCollected: 0, earnedAmount: 0 };
  const lanes = Object.fromEntries(WORKSTREAM_KEYS.map((k) => [k, emptyLane(k)])) as Record<
    WorkstreamKey,
    WorkstreamLaneStats
  >;

  for (const row of oppRows) {
    const stage = row.relationship_stage as RelationshipStage | null;
    if (!stage || !(stage in funnelByStage)) continue;
    funnelByStage[stage] += 1;

    const nextFollowUpAt =
      typeof row.next_follow_up_at === "string" ? row.next_follow_up_at : null;
    const followUpDue =
      isFollowUpDueOnOrBeforeToday(nextFollowUpAt) || Boolean(row.last_inbound_at && !nextFollowUpAt);
    const eventDateEstimate =
      typeof row.event_date_estimate === "string" ? row.event_date_estimate : null;
    const cashNow = matchesCashNow({
      eventDateEstimate,
      relationshipStage: stage,
      followUpDue,
    });
    if (cashNow) cashNowCount += 1;

    const org = orgMetaById.get(String(row.organization_id));
    const orgTypeKey = org?.organization_type_id
      ? orgTypeKeyById.get(org.organization_type_id) ?? null
      : null;
    const oppMeta = row.import_metadata;
    const revenueEngine = readRevenueEngine(oppMeta) ?? readRevenueEngine(org?.import_metadata);
    const flagshipOffer = readFlagshipOffer(oppMeta) ?? readFlagshipOffer(org?.import_metadata);
    const forecast = readDealForecast(oppMeta);
    const workstream = classifyWorkstream({
      revenueEngine,
      flagshipOffer,
      salesInitiative: readSalesInitiative(org?.import_metadata),
      organizationTypeKey: orgTypeKey,
    });
    const lane = lanes[workstream];
    lane.funnelCount += 1;
    if (cashNow) lane.cashNowCount += 1;
    if (stage === "interest") lane.interestCount += 1;
    if (forecast.potentialAmount != null) lane.potentialUsd += forecast.potentialAmount;
    if (
      isQualifiedBuyer({
        hasDecisionMaker: Boolean(row.last_inbound_at) || stage === "interest" || stage === "purchase",
        hasEventDate: Boolean(eventDateEstimate),
        hasPotentialAmount: forecast.potentialAmount != null && forecast.potentialAmount > 0,
        hasNextStep: Boolean(nextFollowUpAt) || followUpDue,
      })
    ) {
      lane.qualifiedCount += 1;
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
    funnelCount: oppRows.length,
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
    workstreams: WORKSTREAM_KEYS.map((k) => lanes[k]),
    bookingRule: PLAYBOOK.bookingRule,
    operatingRule: PLAYBOOK.operatingRule,
  };
}
