import { NextResponse } from "next/server";
import {
  getOpportunity,
  updateOpportunityImportMetadata,
} from "@/lib/sales/db/opportunities";
import {
  isFlagshipOfferKey,
  isRevenueEngineKey,
  readDealEconomics,
  readFlagshipOffer,
  readRevenueEngine,
  withDealEconomics,
  withFlagshipOffer,
  withRevenueEngine,
  type DealEconomicsPatch,
} from "@/lib/sales/engines";

export const dynamic = "force-dynamic";

function parseMoneyField(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Money fields must be non-negative numbers");
  return Math.round(n * 100) / 100;
}

/**
 * PATCH portfolio fields on an opportunity: revenue engine, flagship offer, deal economics.
 * Persisted in import_metadata (no schema migration).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const existing = await getOpportunity(oppId);
    if (!existing) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    let meta: Record<string, unknown> = { ...(existing.importMetadata ?? {}) };

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

    const opportunity = await updateOpportunityImportMetadata(oppId, meta);
    return NextResponse.json({
      opportunity,
      revenueEngine: readRevenueEngine(opportunity.importMetadata),
      flagshipOffer: readFlagshipOffer(opportunity.importMetadata),
      dealEconomics: readDealEconomics(opportunity.importMetadata),
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
      revenueEngine: readRevenueEngine(opportunity.importMetadata),
      flagshipOffer: readFlagshipOffer(opportunity.importMetadata),
      dealEconomics: readDealEconomics(opportunity.importMetadata),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
