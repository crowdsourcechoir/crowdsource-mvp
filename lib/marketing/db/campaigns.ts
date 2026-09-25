import { defaultEmailBlocks } from "../email/render";
import { documentToLegacyBlocks, legacyBlocksToDocument, migrateEmailDocument } from "../document/migrate";
import { EMPTY_EMAIL_STATS, type CampaignStatus, type EmailBlock, type MarketingCampaign, type MarketingEmail, type MarketingEmailStatus } from "../types";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";
import { getMarketingSettings } from "./settings";

type CampaignRow = {
  id: string;
  name: string;
  purpose: string | null;
  status: CampaignStatus;
  document_id: string;
  created_at: string;
  updated_at: string;
};

type SendRow = {
  id: string;
  campaign_id: string;
  status: string;
  subject: string;
  preview_text: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  segment_id: string | null;
  scheduled_for: string | null;
  stats: Partial<MarketingEmail["stats"]> | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  design_system_id: string;
  working_document: unknown;
};

function sendStatus(status: string): MarketingEmailStatus {
  if (status === "scheduled" || status === "sending" || status === "sent" || status === "cancelled") return status;
  if (status === "partially_failed") return "sent";
  return "draft";
}

function statsOf(raw: SendRow["stats"]): MarketingEmail["stats"] {
  return {
    queued: raw?.queued ?? EMPTY_EMAIL_STATS.queued,
    sent: raw?.sent ?? EMPTY_EMAIL_STATS.sent,
    delivered: raw?.delivered ?? EMPTY_EMAIL_STATS.delivered,
    bounced: raw?.bounced ?? EMPTY_EMAIL_STATS.bounced,
    complained: raw?.complained ?? EMPTY_EMAIL_STATS.complained,
    opened: raw?.opened ?? EMPTY_EMAIL_STATS.opened,
    clicked: raw?.clicked ?? EMPTY_EMAIL_STATS.clicked,
    unsubscribed: raw?.unsubscribed ?? EMPTY_EMAIL_STATS.unsubscribed,
  };
}

function toCampaign(row: CampaignRow): MarketingCampaign {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEmail(send: SendRow, document: DocumentRow | undefined): MarketingEmail {
  let blocks: EmailBlock[] = [];
  if (document) {
    try {
      blocks = documentToLegacyBlocks(migrateEmailDocument(document.working_document));
    } catch {
      blocks = [];
    }
  }
  return {
    id: send.id,
    campaignId: send.campaign_id,
    subject: send.subject,
    previewText: send.preview_text,
    fromName: send.from_name ?? "",
    fromEmail: send.from_email ?? "",
    replyTo: send.reply_to,
    blocks,
    segmentId: send.segment_id,
    status: sendStatus(send.status),
    scheduledFor: send.scheduled_for,
    sentAt: send.status === "sent" || send.status === "partially_failed" ? send.completed_at : null,
    stats: statsOf(send.stats),
    createdAt: send.created_at,
    updatedAt: send.updated_at,
  };
}

async function defaultDesignSystemId(): Promise<string> {
  const db = marketingDb();
  const { data, error } = await db.from("email_design_systems").select("id").eq("is_default", true).maybeSingle();
  raiseDb(error);
  if (data?.id) return String(data.id);
  const { data: created, error: insertError } = await db
    .from("email_design_systems")
    .insert({
      name: "Default",
      is_default: true,
      tokens: { schemaVersion: 1, emailWidth: 600, contentWidth: 560 },
    })
    .select("id")
    .single();
  raiseDb(insertError);
  return String((created as { id: string }).id);
}

export async function listCampaignsWithEmails(): Promise<{ campaigns: MarketingCampaign[]; emails: MarketingEmail[] }> {
  const db = marketingDb();
  const { data: campaignRows, error } = await db.from("campaigns").select("*").order("created_at", { ascending: false });
  raiseDb(error);
  const campaigns = (campaignRows ?? []) as CampaignRow[];
  if (campaigns.length === 0) return { campaigns: [], emails: [] };
  const ids = campaigns.map((campaign) => campaign.id);
  const docIds = campaigns.map((campaign) => campaign.document_id);
  const [{ data: sends, error: sendError }, { data: docs, error: docError }] = await Promise.all([
    db.from("campaign_sends").select("*").in("campaign_id", ids),
    db.from("email_documents").select("id, design_system_id, working_document").in("id", docIds),
  ]);
  raiseDb(sendError);
  raiseDb(docError);
  const documents = new Map(((docs ?? []) as DocumentRow[]).map((doc) => [doc.id, doc]));
  const docByCampaign = new Map(campaigns.map((campaign) => [campaign.id, documents.get(campaign.document_id)]));
  return {
    campaigns: campaigns.map(toCampaign),
    emails: ((sends ?? []) as SendRow[]).map((send) => toEmail(send, docByCampaign.get(send.campaign_id))),
  };
}

export async function getCampaignBundle(id: string): Promise<{
  campaign: MarketingCampaign;
  emails: MarketingEmail[];
} | null> {
  const db = marketingDb();
  const { data, error } = await db.from("campaigns").select("*").eq("id", id).maybeSingle();
  raiseDb(error);
  if (!data) return null;
  const campaign = data as CampaignRow;
  const [{ data: sends, error: sendError }, { data: doc, error: docError }] = await Promise.all([
    db.from("campaign_sends").select("*").eq("campaign_id", id).order("created_at", { ascending: true }),
    db.from("email_documents").select("id, design_system_id, working_document").eq("id", campaign.document_id).maybeSingle(),
  ]);
  raiseDb(sendError);
  raiseDb(docError);
  const document = (doc as DocumentRow | null) ?? undefined;
  return {
    campaign: toCampaign(campaign),
    emails: ((sends ?? []) as SendRow[]).map((send) => toEmail(send, document)),
  };
}

export async function getEmailForPreview(sendId: string): Promise<MarketingEmail | null> {
  const db = marketingDb();
  const { data, error } = await db.from("campaign_sends").select("*").eq("id", sendId).maybeSingle();
  raiseDb(error);
  if (!data) return null;
  const send = data as SendRow;
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .select("document_id")
    .eq("id", send.campaign_id)
    .maybeSingle();
  raiseDb(campaignError);
  if (!campaign) return null;
  const { data: doc, error: docError } = await db
    .from("email_documents")
    .select("id, design_system_id, working_document")
    .eq("id", (campaign as { document_id: string }).document_id)
    .maybeSingle();
  raiseDb(docError);
  return toEmail(send, (doc as DocumentRow | null) ?? undefined);
}

export async function createCampaign(input: { name: string; purpose?: string | null; subject?: string; previewText?: string }): Promise<{
  campaign: MarketingCampaign;
  email: MarketingEmail;
}> {
  const settings = await getMarketingSettings();
  const designSystemId = await defaultDesignSystemId();
  const document = legacyBlocksToDocument(defaultEmailBlocks(settings), designSystemId, input.name.trim());
  const db = marketingDb();
  const now = new Date().toISOString();
  const { data: doc, error: docError } = await db
    .from("email_documents")
    .insert({
      kind: "campaign",
      design_system_id: designSystemId,
      working_document: document,
      schema_version: 1,
      updated_at: now,
    })
    .select("id, design_system_id, working_document")
    .single();
  raiseDb(docError);
  const documentRow = doc as DocumentRow;
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .insert({
      name: input.name.trim(),
      purpose: input.purpose ?? null,
      status: "draft",
      document_id: documentRow.id,
      updated_at: now,
    })
    .select("*")
    .single();
  raiseDb(campaignError);
  const campaignRow = campaign as CampaignRow;
  const { data: send, error: sendError } = await db
    .from("campaign_sends")
    .insert({
      campaign_id: campaignRow.id,
      status: "draft",
      subject: input.subject ?? "Crowdsource Choir",
      preview_text: input.previewText ?? "",
      from_name: settings.fromName,
      from_email: settings.fromEmail,
      reply_to: settings.replyTo,
      stats: { ...EMPTY_EMAIL_STATS },
      updated_at: now,
    })
    .select("*")
    .single();
  raiseDb(sendError);
  return { campaign: toCampaign(campaignRow), email: toEmail(send as SendRow, documentRow) };
}

export async function updateCampaign(input: {
  id: string;
  name?: string;
  purpose?: string | null;
  status?: string;
  emailId?: string;
  subject?: string;
  previewText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string | null;
  segmentId?: string | null;
  blocks?: EmailBlock[];
}): Promise<{ campaign: MarketingCampaign; emails: MarketingEmail[] } | null> {
  const db = marketingDb();
  const { data, error } = await db.from("campaigns").select("*").eq("id", input.id).maybeSingle();
  raiseDb(error);
  if (!data) return null;
  const campaign = data as CampaignRow;
  const now = new Date().toISOString();
  const campaignPatch: Record<string, unknown> = { updated_at: now };
  if (typeof input.name === "string") campaignPatch.name = input.name.trim();
  if (input.purpose !== undefined) campaignPatch.purpose = input.purpose;
  if (input.status === "draft" || input.status === "active" || input.status === "archived") {
    campaignPatch.status = input.status;
  }
  const { error: updateError } = await db.from("campaigns").update(campaignPatch).eq("id", campaign.id);
  raiseDb(updateError);

  if (input.blocks) {
    const { data: doc, error: docError } = await db
      .from("email_documents")
      .select("id, design_system_id")
      .eq("id", campaign.document_id)
      .single();
    raiseDb(docError);
    const designSystemId = String((doc as { design_system_id: string }).design_system_id);
    const title = typeof input.name === "string" ? input.name.trim() : campaign.name;
    const working = legacyBlocksToDocument(input.blocks, designSystemId, title);
    const { error: writeError } = await db
      .from("email_documents")
      .update({ working_document: working, schema_version: working.schemaVersion, updated_at: now })
      .eq("id", campaign.document_id);
    raiseDb(writeError);
  }

  if (input.emailId) {
    const sendPatch: Record<string, unknown> = { updated_at: now };
    if (typeof input.subject === "string") sendPatch.subject = input.subject;
    if (typeof input.previewText === "string") sendPatch.preview_text = input.previewText;
    if (typeof input.fromName === "string") sendPatch.from_name = input.fromName;
    if (typeof input.fromEmail === "string") sendPatch.from_email = input.fromEmail;
    if (input.replyTo !== undefined) sendPatch.reply_to = input.replyTo;
    if (input.segmentId !== undefined) sendPatch.segment_id = input.segmentId;
    const { error: sendError } = await db
      .from("campaign_sends")
      .update(sendPatch)
      .eq("id", input.emailId)
      .eq("campaign_id", campaign.id);
    raiseDb(sendError);
  }

  return getCampaignBundle(campaign.id);
}
