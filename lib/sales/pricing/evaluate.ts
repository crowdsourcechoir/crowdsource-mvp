import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { listOrganizationsByIds } from "@/lib/sales/db/organizations";
import { updateOpportunityImportMetadata } from "@/lib/sales/db/opportunities";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import {
  extractAttendance,
  extractMoneyAmounts,
  recommendAnthemPricing,
  type PricingRecommendation,
  type PricingSignals,
} from "@/lib/sales/pricing/framework";
import {
  compareQuoteToSuggested,
  PRICING_FRAMEWORK_VERSION,
  readAnthemPricing,
  withAnthemPricing,
} from "@/lib/sales/pricing/metadata";
import type { Opportunity } from "@/lib/sales/types";

export type EvaluatedProspect = {
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  title: string;
  recommendation: PricingRecommendation;
  bookedAmount: number | null;
  potentialAmount: number | null;
  materialQuoteDifference: boolean;
  skippedAlreadyEvaluated: boolean;
};

export type PricingEvaluationSummary = {
  frameworkVersion: string;
  evaluatedAt: string;
  totalEvaluated: number;
  skippedAlreadyEvaluated: number;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
  withSuggestedFee: number;
  needsReview: number;
  unweightedPipelineUsd: number;
  highestFees: Array<{
    organizationName: string;
    title: string;
    opportunityId: string;
    suggestedAnthemFee: number;
    pricingTier: string;
  }>;
  needingQualification: Array<{
    organizationName: string;
    title: string;
    opportunityId: string;
    pricingQuestions: string[];
  }>;
  materialQuoteGaps: Array<{
    organizationName: string;
    title: string;
    opportunityId: string;
    potentialAmount: number | null;
    bookedAmount: number | null;
    suggestedAnthemFee: number | null;
    differenceUsd: number | null;
  }>;
  errors: Array<{ opportunityId: string; error: string }>;
};

type OppRow = {
  id: string;
  organization_id: string;
  title: string;
  event_or_initiative_name: string | null;
  description: string | null;
  opportunity_type_id: string | null;
  import_metadata: Record<string, unknown> | null;
  relationship_stage: string | null;
};

async function listOpportunityPage(offset: number, limit: number): Promise<OppRow[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select(
      "id, organization_id, title, event_or_initiative_name, description, opportunity_type_id, import_metadata, relationship_stage"
    )
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as OppRow[];
}

/** Prefer rows not yet stamped with this framework version (cron-friendly). */
async function listUnevaluatedOpportunities(limit: number): Promise<OppRow[]> {
  const db = requireSupabaseAdmin();
  // Prefer a jsonb filter (quoted version string — hyphens break unquoted PostgREST values).
  const filtered = await db
    .from("opportunities")
    .select(
      "id, organization_id, title, event_or_initiative_name, description, opportunity_type_id, import_metadata, relationship_stage"
    )
    .or(
      `import_metadata->>pricingFrameworkVersion.is.null,import_metadata->>pricingFrameworkVersion.neq."${PRICING_FRAMEWORK_VERSION}"`
    )
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!filtered.error && (filtered.data?.length ?? 0) > 0) {
    return filtered.data as OppRow[];
  }

  // Fallback: page in created_at order and skip already-stamped rows in memory.
  // Evaluation itself walks oldest-first, so after N priced rows the remainder cluster later.
  const out: OppRow[] = [];
  let offset = 0;
  const pageSize = Math.max(limit * 2, 200);
  for (let guard = 0; guard < 40 && out.length < limit; guard += 1) {
    const { data, error } = await db
      .from("opportunities")
      .select(
        "id, organization_id, title, event_or_initiative_name, description, opportunity_type_id, import_metadata, relationship_stage"
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as OppRow[];
    if (rows.length === 0) break;
    for (const row of rows) {
      const pricing = readAnthemPricing(row.import_metadata);
      if (pricing.pricingFrameworkVersion === PRICING_FRAMEWORK_VERSION && pricing.pricingEvaluatedAt) {
        continue;
      }
      out.push(row);
      if (out.length >= limit) break;
    }
    offset += rows.length;
    if (rows.length < pageSize) break;
  }
  return out;
}

async function loadTypeKeys(): Promise<{
  opportunityTypes: Map<string, string>;
  organizationTypes: Map<string, string>;
}> {
  const db = requireSupabaseAdmin();
  const [oppTypes, orgTypes] = await Promise.all([
    db.from("opportunity_types").select("id, key"),
    db.from("organization_types").select("id, key"),
  ]);
  if (oppTypes.error) throw new Error(oppTypes.error.message);
  if (orgTypes.error) throw new Error(orgTypes.error.message);
  return {
    opportunityTypes: new Map((oppTypes.data ?? []).map((r) => [r.id as string, r.key as string])),
    organizationTypes: new Map((orgTypes.data ?? []).map((r) => [r.id as string, r.key as string])),
  };
}

function buildSignals(input: {
  organizationName: string;
  orgTypeKey: string | null;
  oppTypeKey: string | null;
  salesInitiative: string | null;
  operatorNotes: string | null;
  opportunity: Pick<
    Opportunity,
    "title" | "eventOrInitiativeName" | "description"
  >;
  findingsText: string[];
}): PricingSignals {
  const blob = [
    input.opportunity.description,
    input.operatorNotes,
    ...input.findingsText,
  ]
    .filter(Boolean)
    .join("\n");

  const attendance = extractAttendance(blob);
  // Fundraising goal: only when text explicitly ties money to goal/raise/target.
  let fundraisingGoalUsd: number | null = null;
  let fundraisingGoalVerified = false;
  const goalLine =
    /(?:fundraising\s+)?(?:goal|target|raise[sd]?|fund-?a-?need|paddle)\b[^$.\n]{0,40}\$?\s*([\d,.]+)\s*(k|m|million|thousand)?/i.exec(
      blob
    );
  if (goalLine) {
    const raw = Number(goalLine[1].replace(/,/g, ""));
    const unit = (goalLine[2] ?? "").toLowerCase();
    if (Number.isFinite(raw)) {
      fundraisingGoalUsd = unit.startsWith("m")
        ? raw * 1_000_000
        : unit === "k" || unit === "thousand"
          ? raw * 1_000
          : raw;
      fundraisingGoalVerified = false;
    }
  }
  if (fundraisingGoalUsd == null) {
    const amounts = extractMoneyAmounts(blob).filter((n) => n >= 100_000);
    // Do not auto-pick among multiple — leave unset for recommendAnthemPricing questions.
    if (amounts.length === 1 && /fundrais|gala|auction|benefit/.test(blob.toLowerCase())) {
      fundraisingGoalUsd = amounts[0];
    }
  }

  return {
    organizationName: input.organizationName,
    opportunityTitle: input.opportunity.title,
    eventOrInitiativeName: input.opportunity.eventOrInitiativeName,
    description: input.opportunity.description,
    opportunityTypeKey: input.oppTypeKey,
    organizationTypeKey: input.orgTypeKey,
    salesInitiative: input.salesInitiative,
    fundraisingGoalUsd,
    fundraisingGoalVerified,
    attendance,
    attendanceVerified: false,
    evidenceSnippets: input.findingsText.slice(0, 8),
    operatorNotes: input.operatorNotes,
  };
}

function emptySummary(evaluatedAt: string): PricingEvaluationSummary {
  return {
    frameworkVersion: PRICING_FRAMEWORK_VERSION,
    evaluatedAt,
    totalEvaluated: 0,
    skippedAlreadyEvaluated: 0,
    byCategory: {},
    byTier: {},
    withSuggestedFee: 0,
    needsReview: 0,
    unweightedPipelineUsd: 0,
    highestFees: [],
    needingQualification: [],
    materialQuoteGaps: [],
    errors: [],
  };
}

/**
 * Idempotent Anthem pricing pass over all opportunities.
 * Writes suggested* fields only; never mutates bookedAmount / potentialAmount.
 */
export async function evaluateAnthemPricing(options?: {
  force?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  summary: PricingEvaluationSummary;
  results: EvaluatedProspect[];
  nextOffset: number | null;
  scanned: number;
}> {
  const force = Boolean(options?.force);
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 150);
  const offset = Math.max(options?.offset ?? 0, 0);
  const evaluatedAt = new Date().toISOString();
  const summary = emptySummary(evaluatedAt);
  const results: EvaluatedProspect[] = [];

  // Cron default: only unevaluated rows. force + offset re-pages the full table.
  const rows = force
    ? await listOpportunityPage(offset, limit)
    : await listUnevaluatedOpportunities(limit);
  const { opportunityTypes, organizationTypes } = await loadTypeKeys();
  const organizations = await listOrganizationsByIds(rows.map((r) => r.organization_id));
  const orgById = new Map(organizations.map((o) => [o.id, o]));

  type PendingWrite = {
    row: OppRow;
    organizationName: string;
    organizationId: string;
    recommendation: PricingRecommendation;
    nextMeta: Record<string, unknown>;
  };
  const pending: PendingWrite[] = [];

  for (const row of rows) {
    try {
      const existingPricing = readAnthemPricing(row.import_metadata);
      if (
        !force &&
        existingPricing.pricingFrameworkVersion === PRICING_FRAMEWORK_VERSION &&
        existingPricing.pricingEvaluatedAt
      ) {
        summary.skippedAlreadyEvaluated += 1;
        continue;
      }

      const organization = orgById.get(row.organization_id);
      if (!organization) {
        summary.errors.push({ opportunityId: row.id, error: "Organization missing" });
        continue;
      }

      // Use CRM fields only (title/description/types/notes). Skipping research_findings
      // keeps batch throughput high enough for a full CRM pass under cron time limits.
      const orgMeta = (organization.importMetadata ?? {}) as Record<string, unknown>;
      const operatorNotes =
        typeof orgMeta.operatorNotes === "string"
          ? orgMeta.operatorNotes
          : typeof row.import_metadata?.operatorNotes === "string"
            ? String(row.import_metadata.operatorNotes)
            : null;

      const signals = buildSignals({
        organizationName: organization.name,
        orgTypeKey: organization.organizationTypeId
          ? organizationTypes.get(organization.organizationTypeId) ?? null
          : null,
        oppTypeKey: row.opportunity_type_id
          ? opportunityTypes.get(row.opportunity_type_id) ?? null
          : null,
        salesInitiative: readSalesInitiative(organization.importMetadata) ?? readSalesInitiative(row.import_metadata),
        operatorNotes,
        opportunity: {
          title: row.title,
          eventOrInitiativeName: row.event_or_initiative_name,
          description: row.description,
        },
        findingsText: [],
      });

      const recommendation = recommendAnthemPricing(signals);
      const nextMeta = withAnthemPricing(row.import_metadata, recommendation, evaluatedAt);
      pending.push({
        row,
        organizationName: organization.name,
        organizationId: organization.id,
        recommendation,
        nextMeta,
      });
    } catch (err) {
      summary.errors.push({
        opportunityId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Parallel writes — sequential awaits were capping cron at ~40 rows / tick.
  const WRITE_CONCURRENCY = 20;
  for (let i = 0; i < pending.length; i += WRITE_CONCURRENCY) {
    const chunk = pending.slice(i, i + WRITE_CONCURRENCY);
    const settled = await Promise.all(
      chunk.map(async (item) => {
        try {
          await updateOpportunityImportMetadata(item.row.id, item.nextMeta);
          return { ok: true as const, item };
        } catch (err) {
          return {
            ok: false as const,
            item,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    for (const outcome of settled) {
      if (!outcome.ok) {
        summary.errors.push({ opportunityId: outcome.item.row.id, error: outcome.error });
        continue;
      }
      const { item } = outcome;
      const quote = compareQuoteToSuggested(item.nextMeta);
      const recommendation = item.recommendation;
      results.push({
        opportunityId: item.row.id,
        organizationId: item.organizationId,
        organizationName: item.organizationName,
        title: item.row.title,
        recommendation,
        bookedAmount: quote.bookedAmount,
        potentialAmount: quote.potentialAmount,
        materialQuoteDifference: quote.materialDifference,
        skippedAlreadyEvaluated: false,
      });
      summary.totalEvaluated += 1;

      summary.byCategory[recommendation.pricingCategory] =
        (summary.byCategory[recommendation.pricingCategory] ?? 0) + 1;
      summary.byTier[recommendation.pricingTier] =
        (summary.byTier[recommendation.pricingTier] ?? 0) + 1;

      if (recommendation.suggestedAnthemFee != null) {
        summary.withSuggestedFee += 1;
        summary.unweightedPipelineUsd += recommendation.suggestedAnthemFee;
        summary.highestFees.push({
          organizationName: item.organizationName,
          title: item.row.title,
          opportunityId: item.row.id,
          suggestedAnthemFee: recommendation.suggestedAnthemFee,
          pricingTier: recommendation.pricingTier,
        });
      }
      if (recommendation.suggestedAnthemFee == null || recommendation.pricingTier === "review") {
        summary.needsReview += 1;
        summary.needingQualification.push({
          organizationName: item.organizationName,
          title: item.row.title,
          opportunityId: item.row.id,
          pricingQuestions: recommendation.pricingQuestions,
        });
      }
      if (quote.materialDifference) {
        summary.materialQuoteGaps.push({
          organizationName: item.organizationName,
          title: item.row.title,
          opportunityId: item.row.id,
          potentialAmount: quote.potentialAmount,
          bookedAmount: quote.bookedAmount,
          suggestedAnthemFee: quote.suggestedAnthemFee,
          differenceUsd: quote.differenceUsd,
        });
      }
    }
  }

  summary.highestFees.sort((a, b) => b.suggestedAnthemFee - a.suggestedAnthemFee);
  summary.highestFees = summary.highestFees.slice(0, 25);
  summary.needingQualification = summary.needingQualification.slice(0, 40);
  summary.materialQuoteGaps = summary.materialQuoteGaps.slice(0, 40);

  const nextOffset = force ? (rows.length < limit ? null : offset + rows.length) : null;
  return { summary, results, nextOffset, scanned: rows.length };
}

/** Keep evaluating unevaluated opportunities until empty or time budget. */
export async function drainAnthemPricing(options?: {
  limit?: number;
  budgetMs?: number;
}): Promise<{
  batches: number;
  totalEvaluated: number;
  scanned: number;
  errors: number;
  exhausted: boolean;
  summary: PricingEvaluationSummary;
}> {
  const started = Date.now();
  const budgetMs = options?.budgetMs ?? 240_000;
  const limit = options?.limit ?? 100;
  let batches = 0;
  let totalEvaluated = 0;
  let scanned = 0;
  let errors = 0;
  let lastSummary = emptySummary(new Date().toISOString());

  while (Date.now() - started < budgetMs) {
    const result = await evaluateAnthemPricing({ limit });
    batches += 1;
    totalEvaluated += result.summary.totalEvaluated;
    scanned += result.scanned;
    errors += result.summary.errors.length;
    lastSummary = result.summary;
    // Only stop when the unevaluated query returns nothing. A batch that
    // scanned rows but wrote zero (filter/race) must not mark the CRM drained.
    if (result.scanned === 0) {
      return {
        batches,
        totalEvaluated,
        scanned,
        errors,
        exhausted: true,
        summary: lastSummary,
      };
    }
    if (result.summary.totalEvaluated === 0) {
      // Avoid a tight spin if the filter keeps returning already-priced rows.
      break;
    }
  }

  return {
    batches,
    totalEvaluated,
    scanned,
    errors,
    exhausted: false,
    summary: lastSummary,
  };
}

/** Aggregate status across opportunities (read-only). */
export async function getAnthemPricingStatus(): Promise<{
  frameworkVersion: string;
  totalOpportunities: number;
  evaluatedThisVersion: number;
  withSuggestedFee: number;
  needsReview: number;
  unweightedPipelineUsd: number;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
  highestFees: PricingEvaluationSummary["highestFees"];
  materialQuoteGaps: number;
  done: boolean;
}> {
  const db = requireSupabaseAdmin();
  const { count, error: countErr } = await db
    .from("opportunities")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(countErr.message);

  const pageSize = 200;
  let offset = 0;
  let evaluatedThisVersion = 0;
  let withSuggestedFee = 0;
  let needsReview = 0;
  let unweightedPipelineUsd = 0;
  let materialQuoteGaps = 0;
  const byCategory: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const highestFees: PricingEvaluationSummary["highestFees"] = [];

  for (;;) {
    const { data, error } = await db
      .from("opportunities")
      .select("id, title, organization_id, import_metadata")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const pricing = readAnthemPricing(row.import_metadata);
      if (pricing.pricingFrameworkVersion !== PRICING_FRAMEWORK_VERSION) continue;
      evaluatedThisVersion += 1;
      if (pricing.pricingCategory) {
        byCategory[pricing.pricingCategory] = (byCategory[pricing.pricingCategory] ?? 0) + 1;
      }
      if (pricing.pricingTier) {
        byTier[pricing.pricingTier] = (byTier[pricing.pricingTier] ?? 0) + 1;
      }
      if (pricing.suggestedAnthemFee != null) {
        withSuggestedFee += 1;
        unweightedPipelineUsd += pricing.suggestedAnthemFee;
        highestFees.push({
          organizationName: "",
          title: row.title as string,
          opportunityId: row.id as string,
          suggestedAnthemFee: pricing.suggestedAnthemFee,
          pricingTier: pricing.pricingTier ?? "review",
        });
      }
      if (pricing.suggestedAnthemFee == null || pricing.pricingTier === "review") {
        needsReview += 1;
      }
      if (compareQuoteToSuggested(row.import_metadata).materialDifference) materialQuoteGaps += 1;
    }

    offset += rows.length;
    if (rows.length < pageSize) break;
  }

  highestFees.sort((a, b) => b.suggestedAnthemFee - a.suggestedAnthemFee);
  const totalOpportunities = count ?? 0;
  return {
    frameworkVersion: PRICING_FRAMEWORK_VERSION,
    totalOpportunities,
    evaluatedThisVersion,
    withSuggestedFee,
    needsReview,
    unweightedPipelineUsd,
    byCategory,
    byTier,
    highestFees: highestFees.slice(0, 15),
    materialQuoteGaps,
    done: totalOpportunities > 0 && evaluatedThisVersion >= totalOpportunities,
  };
}
