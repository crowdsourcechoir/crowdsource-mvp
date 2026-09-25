import { migrateEmailDocument } from "../document/migrate";
import type { EmailDocument } from "../document/types";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";

export async function getWorkingDocument(id: string): Promise<{
  document: EmailDocument;
  tokens: unknown;
  previewText: string;
} | null> {
  const db = marketingDb();
  const { data, error } = await db
    .from("email_documents")
    .select("id, working_document, design_system_id")
    .eq("id", id)
    .maybeSingle();
  raiseDb(error);
  if (!data) return null;
  const row = data as { working_document: unknown; design_system_id: string };
  const { data: design, error: designError } = await db
    .from("email_design_systems")
    .select("tokens")
    .eq("id", row.design_system_id)
    .maybeSingle();
  raiseDb(designError);
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .select("id")
    .eq("document_id", id)
    .maybeSingle();
  raiseDb(campaignError);
  let previewText = "";
  if (campaign?.id) {
    const { data: send, error: sendError } = await db
      .from("campaign_sends")
      .select("preview_text")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    raiseDb(sendError);
    previewText = typeof (send as { preview_text?: string } | null)?.preview_text === "string" ? (send as { preview_text: string }).preview_text : "";
  }
  return {
    document: migrateEmailDocument(row.working_document),
    tokens: (design as { tokens?: unknown } | null)?.tokens ?? null,
    previewText,
  };
}

/** Insert-only snapshot. The table trigger rejects later updates. */
export async function insertDocumentVersion(input: {
  documentId: string;
  document: EmailDocument;
  mjml: string;
  html: string;
  textPlain: string;
  rendererVersion: string;
}): Promise<string> {
  const db = marketingDb();
  const { data: latest, error: readError } = await db
    .from("email_document_versions")
    .select("version_number")
    .eq("document_id", input.documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  raiseDb(readError);
  const versionNumber = ((latest as { version_number?: number } | null)?.version_number ?? 0) + 1;
  const { data, error } = await db
    .from("email_document_versions")
    .insert({
      document_id: input.documentId,
      version_number: versionNumber,
      document: input.document,
      mjml: input.mjml,
      html: input.html,
      text_plain: input.textPlain,
      renderer_version: input.rendererVersion,
    })
    .select("id")
    .single();
  raiseDb(error);
  return String((data as { id: string }).id);
}
