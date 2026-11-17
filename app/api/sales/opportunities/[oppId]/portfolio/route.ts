import { NextResponse } from "next/server";
import {
  getOpportunity,
  updateOpportunityImportMetadata,
} from "@/lib/sales/db/opportunities";
import {
  isBusinessCategoryKey,
  isDealTypeKey,
  isProductExperienceKey,
  readBusinessCategory,
  readDealType,
  readEditionBloom,
  readProductExperience,
  withBusinessCategory,
  withDealType,
  withEditionBloom,
  withProductExperience,
} from "@/lib/sales/business-model";
import {
  isFlagshipOfferKey,
  isRevenueEngineKey,
  readDealEconomics,
  readDealForecast,
  readFlagshipOffer,
  readRevenueEngine,
  withDealEconomics,
  withDealForecast,
  withFlagshipOffer,
  withRevenueEngine,
  type DealEconomicsPatch,
  type DealForecastPatch,
} from "@/lib/sales/engines";

export const dynamic = "force-dynamic";

function parseMoneyField(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Money fields must be non-negative numbers");
  return Math.round(n * 100) / 100;
}

function parseDateField(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("Payment dates must be YYYY-MM-DD");
  const value = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Payment dates must be YYYY-MM-DD");
  return value;
}

/**
 * PATCH portfolio fields on an opportunity: business category / product / deal type /
 * edition, revenue engine, flagship offer, potential deal + payment schedule, and
 * booked/cash/earned. Persisted in import_metadata (no schema migration).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const existing = await getOpportunity(oppId);
    if (!existing) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    let meta: Record<string, unknown> = { ...(existing.importMetadata ?? {}) };

    if ("productExperience" in body) {
      const raw = body.productExperience;
      if (raw === null || raw === "") {
        meta = withProductExperience(meta, null);
      } else if (isProductExperienceKey(raw)) {
        meta = withProductExperience(meta, raw);
      } else {
        return NextResponse.json({ error: `Invalid productExperience "${String(raw)}"` }, { status: 400 });
      }
    }

    if ("businessCategory" in body) {
      const raw = body.businessCategory;
      if (raw === null || raw === "") {
        meta = withBusinessCategory(meta, null);
      } else if (isBusinessCategoryKey(raw)) {
        meta = withBusinessCategory(meta, raw);
      } else {
        return NextResponse.json({ error: `Invalid businessCategory "${String(raw)}"` }, { status: 400 });
      }
    }

    if ("dealType" in body) {
      const raw = body.dealType;
      if (raw === null || raw === "") {
        meta = withDealType(meta, null);
      } else if (isDealTypeKey(raw)) {
        meta = withDealType(meta, raw);
      } else {
        return NextResponse.json({ error: `Invalid dealType "${String(raw)}"` }, { status: 400 });
      }
    }

    if ("editionBloom" in body) {
      const raw = body.editionBloom;
      if (raw === null || raw === "") {
        meta = withEditionBloom(meta, null);
      } else if (typeof raw === "string") {
        meta = withEditionBloom(meta, raw);
      } else {
        return NextResponse.json({ error: "editionBloom must be a string" }, { status: 400 });
      }
    }

    if ("revenueEngine" in body) {
      const raw = body.revenueEngine;
      if (raw === null || raw === "") {
        meta = withRevenueEngine(meta, null);
      } else if (isRevenueEngineKey(raw)) {
        meta = withRevenueEngine(meta, raw);
      } else {
        return NextResponse.json({ error: `Invalid revenueEngine "${String(raw)}"` }, { status: 400 });
      }
    }

    if ("flagshipOffer" in body) {
      const raw = body.flagshipOffer;
      if (raw === null || raw === "") {
        meta = withFlagshipOffer(meta, null);
      } else if (isFlagshipOfferKey(raw)) {
        meta = withFlagshipOffer(meta, raw);
      } else {
        return NextResponse.json({ error: `Invalid flagshipOffer "${String(raw)}"` }, { status: 400 });
      }
    }

    const economicsPatch: DealEconomicsPatch = {};
    let hasEconomics = false;
    for (const key of ["bookedAmount", "cashCollected", "earnedAmount"] as const) {
      if (key in body) {
        economicsPatch[key] = parseMoneyField(body[key]);
        hasEconomics = true;
      }
    }
    if (hasEconomics) {
      meta = withDealEconomics(meta, economicsPatch);
    }

    const forecastPatch: DealForecastPatch = {};
    let hasForecast = false;
    if ("potentialAmount" in body) {
      forecastPatch.potentialAmount = parseMoneyField(body.potentialAmount);
      hasForecast = true;
    }
    if ("firstPaymentAmount" in body) {
      forecastPatch.firstPaymentAmount = parseMoneyField(body.firstPaymentAmount);
      hasForecast = true;
    }
    if ("secondPaymentAmount" in body) {
      forecastPatch.secondPaymentAmount = parseMoneyField(body.secondPaymentAmount);
      hasForecast = true;
    }
    if ("firstPaymentAt" in body) {
      forecastPatch.firstPaymentAt = parseDateField(body.firstPaymentAt);
      hasForecast = true;
    }
    if ("secondPaymentAt" in body) {
      forecastPatch.secondPaymentAt = parseDateField(body.secondPaymentAt);
      hasForecast = true;
    }
    if (body.splitHalves === true) {
      forecastPatch.splitHalves = true;
      hasForecast = true;
    }
    if (hasForecast) {
      meta = withDealForecast(meta, forecastPatch);
    }

    const opportunity = await updateOpportunityImportMetadata(oppId, meta);
    return NextResponse.json({
      opportunity,
      businessCategory: readBusinessCategory(opportunity.importMetadata),
      productExperience: readProductExperience(opportunity.importMetadata),
      dealType: readDealType(opportunity.importMetadata),
      editionBloom: readEditionBloom(opportunity.importMetadata),
      revenueEngine: readRevenueEngine(opportunity.importMetadata),
      flagshipOffer: readFlagshipOffer(opportunity.importMetadata),
      dealEconomics: readDealEconomics(opportunity.importMetadata),
      dealForecast: readDealForecast(opportunity.importMetadata),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const opportunity = await getOpportunity(oppId);
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    return NextResponse.json({
      opportunity,
      businessCategory: readBusinessCategory(opportunity.importMetadata),
      productExperience: readProductExperience(opportunity.importMetadata),
      dealType: readDealType(opportunity.importMetadata),
      editionBloom: readEditionBloom(opportunity.importMetadata),
      revenueEngine: readRevenueEngine(opportunity.importMetadata),
      flagshipOffer: readFlagshipOffer(opportunity.importMetadata),
      dealEconomics: readDealEconomics(opportunity.importMetadata),
      dealForecast: readDealForecast(opportunity.importMetadata),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
