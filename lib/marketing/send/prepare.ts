import { getEventForMarketingBlock } from "../events-readonly";
import { insertDocumentVersion } from "../db/documents";
import { marketingDb } from "../db/client";
import { MarketingDbError, raiseDb } from "../db/errors";
import { getMarketingSettings } from "../db/settings";
import { migrateEmailDocument } from "../document/migrate";
import type { EmailDocument } from "../document/types";
import { compileEmailDocument, MJML_RENDERER_VERSION } from "../render/compile";
import type { EventBlockData } from "../render/event-data";
import { resolveEmailTokens } from "../render/tokens";
import { siteUrl } from "../../site-url";

export type PreparedSend = {
  sendId: string;
  campaignId: string;
  documentId: string;
  versionId: string;
  document: EmailDocument;
  html: string;
  text: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  segmentId: string | null;
  companyName: string;
  physicalAddress: string;
};

function propString(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value : "";
}

export async function prepareSendVersion(sendId: string): Promise<PreparedSend> {
  const db = marketingDb();
  const { data: sendRow, error: sendError } = await db.from("campaign_sends").select("*").eq("id", sendId).maybeSingle();
  raiseDb(sendError);
  if (!sendRow) throw new MarketingDbError("Not found", 404);
  const send = sendRow as {
    id: string;
    campaign_id: string;
    subject: string;
    preview_text: string;
    from_name: string | null;
    from_email: string | null;
    reply_to: string | null;
    segment_id: string | null;
    status: string;
  };
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .select("id, document_id, name")
    .eq("id", send.campaign_id)
    .maybeSingle();
  raiseDb(campaignError);
  if (!campaign) throw new MarketingDbError("Not found", 404);
  const documentId = String((campaign as { document_id: string }).document_id);
  const { data: doc, error: docError } = await db
    .from("email_documents")
    .select("working_document, design_system_id")
    .eq("id", documentId)
    .maybeSingle();
  raiseDb(docError);
  if (!doc) throw new MarketingDbError("Not found", 404);
  const row = doc as { working_document: unknown; design_system_id: string };
  const { data: design, error: designError } = await db
    .from("email_design_systems")
    .select("tokens")
    .eq("id", row.design_system_id)
    .maybeSingle();
  raiseDb(designError);
  const settings = await getMarketingSettings();
  const document = migrateEmailDocument(row.working_document);
  const events: Record<string, EventBlockData | null> = {};
  const origin = siteUrl();
  for (const section of document.sections) {
    if (section.type !== "event") continue;
    const eventId = propString(section.props, "eventId");
    events[section.id] = eventId ? await getEventForMarketingBlock(eventId, origin) : null;
  }
  const compiled = compileEmailDocument({
    document,
    tokens: resolveEmailTokens((design as { tokens?: unknown } | null)?.tokens),
    previewText: send.preview_text,
    companyName: settings.companyName,
    physicalAddress: settings.physicalAddress,
    eventsBySectionId: events,
  });
  if (!compiled.ok) {
    throw new MarketingDbError(compiled.errors[0] || "The email did not compile.", 422);
  }
  const versionId = await insertDocumentVersion({
    documentId,
    document,
    mjml: compiled.mjml,
    html: compiled.html,
    textPlain: compiled.text,
    rendererVersion: MJML_RENDERER_VERSION,
  });
  const seen = new Set<string>();
  const linkRows = compiled.links
    .filter((link) => {
      const key = link.url.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((link) => ({
      document_version_id: versionId,
      section_id: "compiled",
      href: link.url,
      label: link.label || null,
    }));
  if (linkRows.length) {
    const { error: linkError } = await db.from("email_links").insert(linkRows);
    raiseDb(linkError);
  }
  return {
    sendId: send.id,
    campaignId: send.campaign_id,
    documentId,
    versionId,
    document,
    html: compiled.html,
    text: compiled.text,
    subject: send.subject || "Crowdsource Choir",
    previewText: send.preview_text,
    fromName: send.from_name || settings.fromName,
    fromEmail: (send.from_email || settings.fromEmail).trim(),
    replyTo: send.reply_to || settings.replyTo,
    segmentId: send.segment_id,
    companyName: settings.companyName,
    physicalAddress: settings.physicalAddress,
  };
}
