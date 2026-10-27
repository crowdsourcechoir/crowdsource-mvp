import { callStructuredVision } from "@/lib/sales/openai/client";
import { BusinessCardExtractSchema, type BusinessCardExtract } from "./schema";

const SYSTEM = `You read business-card photos for Crowdsource Choir sales.

Extract every contact field that is clearly printed. Do not invent values.
If a field is missing or unreadable, return null for that field.
Prefer the person's work email over personal when both appear.
Normalize website to include https:// when a bare domain is shown.
Keep notes short (one line). confidence reflects how legible the card is overall.`;

const DATA_URL_RE = /^data:(image\/(?:jpeg|jpg|png|webp));base64,[A-Za-z0-9+/=\s]+$/i;

export function assertCardImageDataUrl(raw: string): string {
  const value = raw.trim();
  if (!DATA_URL_RE.test(value)) {
    throw new Error("Upload a JPEG, PNG, or WebP photo of the card.");
  }
  // ~4MB raw base64 ceiling keeps Vercel body limits safe.
  if (value.length > 5_500_000) {
    throw new Error("Photo is too large — retake closer or compress and try again.");
  }
  return value;
}

export function normalizeCardExtract(parsed: BusinessCardExtract): BusinessCardExtract {
  const clean = (v: string | null | undefined): string | null => {
    if (v == null) return null;
    const t = v.replace(/\s+/g, " ").trim();
    return t.length > 0 ? t : null;
  };
  let websiteUrl = clean(parsed.websiteUrl);
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl) && /^[\w.-]+\.[a-z]{2,}/i.test(websiteUrl)) {
    websiteUrl = `https://${websiteUrl.replace(/^\/+/, "")}`;
  }
  let linkedinUrl = clean(parsed.linkedinUrl);
  if (linkedinUrl && !/^https?:\/\//i.test(linkedinUrl) && /linkedin\.com/i.test(linkedinUrl)) {
    linkedinUrl = `https://${linkedinUrl.replace(/^\/+/, "")}`;
  }
  return {
    fullName: clean(parsed.fullName),
    roleTitle: clean(parsed.roleTitle),
    organizationName: clean(parsed.organizationName),
    email: clean(parsed.email)?.toLowerCase() ?? null,
    phone: clean(parsed.phone),
    websiteUrl,
    linkedinUrl,
    notes: clean(parsed.notes),
    confidence: Number.isFinite(parsed.confidence) ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
  };
}

export async function extractBusinessCardFromImage(imageDataUrl: string): Promise<{
  extract: BusinessCardExtract;
  model: string;
  costUsd: number;
}> {
  const dataUrl = assertCardImageDataUrl(imageDataUrl);
  const result = await callStructuredVision({
    schema: BusinessCardExtractSchema,
    schemaName: "business_card_extract",
    systemPrompt: SYSTEM,
    userText: "Extract the contact fields from this business card photo.",
    imageDataUrl: dataUrl,
    model: "gpt-4o",
  });
  return {
    extract: normalizeCardExtract(result.parsed),
    model: result.model,
    costUsd: result.costUsd,
  };
}
