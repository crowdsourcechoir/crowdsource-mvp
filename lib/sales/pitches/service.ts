import { randomBytes } from "crypto";
import { getOpportunity } from "../db/opportunities";
import { getOrganization } from "../db/organizations";
import { listContactsForOrganization } from "../db/contacts";
import { getQueueItemByOpportunity } from "../db/queue";
import { getDraft } from "../db/outreach";
import { getLatestBriefForOpportunity } from "../db/pipeline";
import {
  copySlidesTemplate,
  exportPresentationPdf,
  replacePlaceholdersInPresentation,
  slidesUrlForPresentation,
} from "./slides-client";
import { readPitchStore, updatePitchStore } from "./store";
import type { PitchStatus, PitchTemplate, SalesPitch } from "./types";
import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function pitchToken(): string {
  return randomBytes(18).toString("base64url");
}

function publicPitchUrl(token: string): string {
  return `${siteUrl()}/p/${token}`;
}

export function pitchShareUrl(pitch: SalesPitch): string {
  return publicPitchUrl(pitch.protectedToken);
}

async function buildReplacements(input: {
  opportunityId: string;
  promptText?: string | null;
}): Promise<Record<string, string>> {
  const opportunity = await getOpportunity(input.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  const organization = await getOrganization(opportunity.organizationId);
  const contacts = await listContactsForOrganization(opportunity.organizationId);
  const primary = contacts.find((c) => c.email) ?? contacts[0] ?? null;

  let fitBlurb = (input.promptText ?? "").trim();
  if (!fitBlurb) {
    try {
      const brief = await getLatestBriefForOpportunity(opportunity.id);
      if (brief?.recommendedAngle) fitBlurb = brief.recommendedAngle.slice(0, 600);
      else if (brief?.summary) fitBlurb = brief.summary.slice(0, 600);
    } catch {
      /* optional when DB missing */
    }
  }
  if (!fitBlurb) {
    try {
      const queueItem = await getQueueItemByOpportunity(opportunity.id);
      if (queueItem?.outreachDraftId) {
        const draft = await getDraft(queueItem.outreachDraftId);
        const body = (draft?.editedBody || draft?.aiBody || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        fitBlurb = body.slice(0, 600);
      }
    } catch {
      /* optional */
    }
  }
  if (!fitBlurb) {
    fitBlurb = `Crowdsource Choir creates participatory musical experiences for ${organization?.name ?? "your community"}.`;
  }

  return {
    "{{org_name}}": organization?.name ?? "Your organization",
    "{{opportunity_title}}": opportunity.title ?? "",
    "{{contact_name}}": primary?.fullName ?? "",
    "{{contact_role}}": primary?.roleTitle ?? "",
    "{{fit_blurb}}": fitBlurb,
    "{{event_or_initiative}}": opportunity.eventOrInitiativeName ?? opportunity.title ?? "",
  };
}

export async function listPitchesForOpportunity(opportunityId: string): Promise<SalesPitch[]> {
  const { store } = await readPitchStore();
  return store.pitches.filter((p) => p.opportunityId === opportunityId && p.status !== "archived");
}

export async function getPitchById(id: string): Promise<SalesPitch | null> {
  const { store } = await readPitchStore();
  return store.pitches.find((p) => p.id === id) ?? null;
}

export async function getPitchByToken(token: string): Promise<SalesPitch | null> {
  const { store } = await readPitchStore();
  return store.pitches.find((p) => p.protectedToken === token) ?? null;
}

export async function listPitchTemplates(): Promise<PitchTemplate[]> {
  const { store } = await readPitchStore();
  return store.templates.filter((t) => t.isActive);
}

export async function upsertPitchTemplate(input: {
  id?: string;
  name: string;
  description?: string | null;
  googleSlidesTemplateFileId: string;
}): Promise<PitchTemplate> {
  const now = new Date().toISOString();
  let saved: PitchTemplate | null = null;
  await updatePitchStore((store) => {
    if (input.id) {
      const existing = store.templates.find((t) => t.id === input.id);
      if (existing) {
        existing.name = input.name.trim();
        existing.description = input.description ?? null;
        existing.googleSlidesTemplateFileId = input.googleSlidesTemplateFileId.trim();
        existing.updatedAt = now;
        existing.isActive = true;
        saved = existing;
        return;
      }
    }
    const template: PitchTemplate = {
      id: input.id ?? newId("tpl"),
      name: input.name.trim(),
      description: input.description ?? null,
      googleSlidesTemplateFileId: input.googleSlidesTemplateFileId.trim(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    store.templates.unshift(template);
    if (!store.settings.defaultTemplateFileId) {
      store.settings.defaultTemplateFileId = template.googleSlidesTemplateFileId;
    }
    saved = template;
  });
  if (!saved) throw new Error("Failed to save template");
  return saved;
}

export async function updatePitchSettings(input: { defaultTemplateFileId?: string | null }): Promise<void> {
  await updatePitchStore((store) => {
    if (input.defaultTemplateFileId !== undefined) {
      store.settings.defaultTemplateFileId = input.defaultTemplateFileId;
    }
  });
}

export async function createPitch(input: {
  opportunityId: string;
  title?: string;
  promptText?: string | null;
  templateId?: string | null;
  /** Manual Slides URL when API copy is not available yet */
  googleSlidesUrl?: string | null;
  googlePresentationId?: string | null;
}): Promise<SalesPitch> {
  const opportunity = await getOpportunity(input.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  const organization = await getOrganization(opportunity.organizationId);
  const { store } = await readPitchStore();

  const template =
    (input.templateId ? store.templates.find((t) => t.id === input.templateId) : null) ??
    store.templates.find((t) => t.isActive) ??
    null;

  const title =
    input.title?.trim() ||
    `Pitch — ${organization?.name ?? "Prospect"} — ${opportunity.title ?? "Opportunity"}`;

  let googlePresentationId = input.googlePresentationId ?? null;
  let googleSlidesUrl = input.googleSlidesUrl ?? null;
  let status: PitchStatus = googleSlidesUrl ? "editing" : "draft";

  const templateFileId =
    template?.googleSlidesTemplateFileId || store.settings.defaultTemplateFileId || null;

  if (!googlePresentationId && templateFileId) {
    try {
      const copied = await copySlidesTemplate({ templateFileId, title });
      googlePresentationId = copied.presentationId;
      googleSlidesUrl = copied.url;
      status = "editing";
      const replacements = await buildReplacements({
        opportunityId: opportunity.id,
        promptText: input.promptText,
      });
      await replacePlaceholdersInPresentation(copied.presentationId, replacements);
    } catch (err) {
      // Allow creating a pitch shell even if Slides API fails (e.g. scopes not granted yet).
      if (!googleSlidesUrl) {
        throw err instanceof Error ? err : new Error("Could not create Google Slides deck.");
      }
    }
  }

  const now = new Date().toISOString();
  const pitch: SalesPitch = {
    id: newId("pitch"),
    opportunityId: opportunity.id,
    organizationId: opportunity.organizationId,
    organizationName: organization?.name ?? null,
    opportunityTitle: opportunity.title ?? null,
    templateId: template?.id ?? null,
    title,
    status,
    promptText: input.promptText ?? null,
    googlePresentationId,
    googleSlidesUrl,
    protectedToken: pitchToken(),
    pdfStoragePath: null,
    lastSyncedAt: googlePresentationId ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  await updatePitchStore((s) => {
    s.pitches.unshift(pitch);
  });
  return pitch;
}

export async function updatePitch(
  id: string,
  patch: Partial<
    Pick<
      SalesPitch,
      | "title"
      | "status"
      | "promptText"
      | "googlePresentationId"
      | "googleSlidesUrl"
      | "pdfStoragePath"
    >
  >
): Promise<SalesPitch> {
  let updated: SalesPitch | null = null;
  await updatePitchStore((store) => {
    const pitch = store.pitches.find((p) => p.id === id);
    if (!pitch) return;
    if (typeof patch.title === "string") pitch.title = patch.title;
    if (patch.status) pitch.status = patch.status;
    if (patch.promptText !== undefined) pitch.promptText = patch.promptText;
    if (patch.googlePresentationId !== undefined) pitch.googlePresentationId = patch.googlePresentationId;
    if (patch.googleSlidesUrl !== undefined) {
      pitch.googleSlidesUrl = patch.googleSlidesUrl;
      if (patch.googleSlidesUrl && !pitch.googlePresentationId) {
        const match = patch.googleSlidesUrl.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
        if (match?.[1]) pitch.googlePresentationId = match[1];
      }
    }
    if (patch.pdfStoragePath !== undefined) pitch.pdfStoragePath = patch.pdfStoragePath;
    pitch.updatedAt = new Date().toISOString();
    updated = pitch;
  });
  if (!updated) throw new Error("Pitch not found");
  return updated;
}

export async function refillPitchPlaceholders(id: string): Promise<SalesPitch> {
  const pitch = await getPitchById(id);
  if (!pitch?.googlePresentationId) throw new Error("Pitch has no Google Slides presentation.");
  const replacements = await buildReplacements({
    opportunityId: pitch.opportunityId,
    promptText: pitch.promptText,
  });
  await replacePlaceholdersInPresentation(pitch.googlePresentationId, replacements);
  return updatePitch(id, { status: "editing" });
}

export async function exportPitchPdf(id: string): Promise<SalesPitch> {
  const pitch = await getPitchById(id);
  if (!pitch?.googlePresentationId) throw new Error("Pitch has no Google Slides presentation.");
  const pdf = await exportPresentationPdf(pitch.googlePresentationId);

  const objectPath = `sales-pitches/pdfs/${pitch.id}.pdf`;
  if (supabaseAdmin) {
    const bucket = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
    const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw new Error(error.message);
  } else {
    const { writeFileSync, mkdirSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(process.cwd(), ".data", "pitch-pdfs");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${pitch.id}.pdf`), pdf);
  }

  return updatePitch(id, { pdfStoragePath: objectPath, status: "ready" });
}

export async function markPitchShared(id: string): Promise<SalesPitch> {
  return updatePitch(id, { status: "shared" });
}

/** Ensure googleSlidesUrl is set when we only have an id. */
export function ensureSlidesUrl(pitch: SalesPitch): SalesPitch {
  if (pitch.googleSlidesUrl || !pitch.googlePresentationId) return pitch;
  return { ...pitch, googleSlidesUrl: slidesUrlForPresentation(pitch.googlePresentationId) };
}
