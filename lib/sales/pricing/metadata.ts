/**
 * Anthem pricing recommendation fields on opportunities.import_metadata.
 *
 * Kept separate from bookedAmount / potentialAmount so quotes and signed deals
 * are never overwritten by internal suggestions.
 */

import type {
  PricingCategory,
  PricingConfidence,
  PricingRecommendation,
  PricingTierKey,
  SponsorshipPotential,
} from "@/lib/sales/pricing/framework";
import { readDealEconomics, readDealForecast } from "@/lib/sales/engines";

export type AnthemPricingMeta = {
  suggestedAnthemFee: number | null;
  pricingCategory: PricingCategory | null;
  pricingTier: PricingTierKey | null;
  pricingRationale: string | null;
  pricingConfidence: PricingConfidence | null;
  pricingEvidence: string[];
  pricingQuestions: string[];
  sponsorshipPotential: SponsorshipPotential | null;
  pricingEvaluatedAt: string | null;
  pricingFrameworkVersion: string | null;
};

export const PRICING_FRAMEWORK_VERSION = "anthem-2026-11";

const CATEGORIES = new Set(["fundraiser", "conference", "corporate", "other"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);
const SPONSORSHIP = new Set(["yes", "no", "unknown"]);

function asMeta(importMetadata: unknown): Record<string, unknown> | null {
  if (!importMetadata || typeof importMetadata !== "object") return null;
  return importMetadata as Record<string, unknown>;
}

function coerceMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
}

export function readAnthemPricing(importMetadata: unknown): AnthemPricingMeta {
  const meta = asMeta(importMetadata);
  if (!meta) {
    return {
      suggestedAnthemFee: null,
      pricingCategory: null,
      pricingTier: null,
      pricingRationale: null,
      pricingConfidence: null,
      pricingEvidence: [],
      pricingQuestions: [],
      sponsorshipPotential: null,
      pricingEvaluatedAt: null,
      pricingFrameworkVersion: null,
    };
  }
  const category = typeof meta.pricingCategory === "string" ? meta.pricingCategory : null;
  const confidence = typeof meta.pricingConfidence === "string" ? meta.pricingConfidence : null;
  const sponsorship =
    typeof meta.sponsorshipPotential === "string" ? meta.sponsorshipPotential : null;
  return {
    suggestedAnthemFee: coerceMoney(meta.suggestedAnthemFee),
    pricingCategory: category && CATEGORIES.has(category) ? (category as PricingCategory) : null,
    pricingTier: typeof meta.pricingTier === "string" ? (meta.pricingTier as PricingTierKey) : null,
    pricingRationale: typeof meta.pricingRationale === "string" ? meta.pricingRationale : null,
    pricingConfidence:
      confidence && CONFIDENCES.has(confidence) ? (confidence as PricingConfidence) : null,
    pricingEvidence: asStringArray(meta.pricingEvidence),
    pricingQuestions: asStringArray(meta.pricingQuestions),
    sponsorshipPotential:
      sponsorship && SPONSORSHIP.has(sponsorship) ? (sponsorship as SponsorshipPotential) : null,
    pricingEvaluatedAt: typeof meta.pricingEvaluatedAt === "string" ? meta.pricingEvaluatedAt : null,
    pricingFrameworkVersion:
      typeof meta.pricingFrameworkVersion === "string" ? meta.pricingFrameworkVersion : null,
  };
}

/** Merge recommendation into metadata. Never touches booked/potential/cash/earned. */
export function withAnthemPricing(
  importMetadata: Record<string, unknown> | null | undefined,
  recommendation: PricingRecommendation,
  evaluatedAt: string = new Date().toISOString()
): Record<string, unknown> {
  const next = { ...(importMetadata ?? {}) };
  if (recommendation.suggestedAnthemFee == null) delete next.suggestedAnthemFee;
  else next.suggestedAnthemFee = recommendation.suggestedAnthemFee;
  next.pricingCategory = recommendation.pricingCategory;
  next.pricingTier = recommendation.pricingTier;
  next.pricingRationale = recommendation.pricingRationale;
  next.pricingConfidence = recommendation.pricingConfidence;
  next.pricingEvidence = recommendation.pricingEvidence;
  next.pricingQuestions = recommendation.pricingQuestions;
  next.sponsorshipPotential = recommendation.sponsorshipPotential;
  next.pricingEvaluatedAt = evaluatedAt;
  next.pricingFrameworkVersion = PRICING_FRAMEWORK_VERSION;
  return next;
}

export type QuoteVsSuggested = {
  bookedAmount: number | null;
  potentialAmount: number | null;
  suggestedAnthemFee: number | null;
  /** True when an existing quote/potential differs from suggestion by ≥25% or ≥$2.5k. */
  materialDifference: boolean;
  differenceUsd: number | null;
};

export function compareQuoteToSuggested(importMetadata: unknown): QuoteVsSuggested {
  const economics = readDealEconomics(importMetadata);
  const forecast = readDealForecast(importMetadata);
  const pricing = readAnthemPricing(importMetadata);
  const existing = economics.bookedAmount ?? forecast.potentialAmount;
  const suggested = pricing.suggestedAnthemFee;
  if (existing == null || suggested == null) {
    return {
      bookedAmount: economics.bookedAmount,
      potentialAmount: forecast.potentialAmount,
      suggestedAnthemFee: suggested,
      materialDifference: false,
      differenceUsd: null,
    };
  }
  const differenceUsd = suggested - existing;
  const materialDifference =
    Math.abs(differenceUsd) >= 2_500 || Math.abs(differenceUsd) / Math.max(existing, 1) >= 0.25;
  return {
    bookedAmount: economics.bookedAmount,
    potentialAmount: forecast.potentialAmount,
    suggestedAnthemFee: suggested,
    materialDifference,
    differenceUsd,
  };
}
