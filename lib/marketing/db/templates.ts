import { migrateEmailDocument } from "../document/migrate";
import { parseEmailDocument } from "../document/schema";
import type { EmailDocument, EmailSection } from "../document/types";
import { documentFromTemplate } from "../editor/sections";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";

export type EmailTemplateSummary = {
  id: string;
  name: string;
  description: string;
};

export async function listEmailTemplates(): Promise<EmailTemplateSummary[]> {
  const db = marketingDb();
  const { data, error } = await db.from("email_templates").select("id, name, description").order("updated_at", { ascending: false });
  raiseDb(error);
  return ((data ?? []) as { id: string; name: string; description: string | null }[]).map((row) => ({
    id: String(row.id),
    name: row.name,
    description: row.description ?? "",
  }));
}

export async function createEmailTemplate(input: {
  name: string;
  description?: string;
  sections: EmailSection[];
  designSystemId: string;
}): Promise<EmailTemplateSummary> {
  const db = marketingDb();
  const document = parseEmailDocument({
    schemaVersion: 1,
    designSystemId: input.designSystemId,
    meta: { internalTitle: input.name.trim() },
    personalization: { missingTokenBehavior: "fallback", fallbacks: { first_name: "friend" } },
    sections: input.sections,
  });
  const { data: doc, error: docError } = await db
    .from("email_documents")
    .insert({
      kind: "template",
      design_system_id: input.designSystemId,
      working_document: document,
      schema_version: 1,
    })
    .select("id")
    .single();
  raiseDb(docError);
  const documentId = String((doc as { id: string }).id);
  const { data, error } = await db
    .from("email_templates")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      document_id: documentId,
    })
    .select("id, name, description")
    .single();
  raiseDb(error);
  const row = data as { id: string; name: string; description: string | null };
  return { id: String(row.id), name: row.name, description: row.description ?? "" };
}

export async function applyEmailTemplate(templateId: string, campaignId: string): Promise<EmailDocument | null> {
  const db = marketingDb();
  const { data: template, error: templateError } = await db
    .from("email_templates")
    .select("document_id")
    .eq("id", templateId)
    .maybeSingle();
  raiseDb(templateError);
  if (!template) return null;
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .select("id, name, document_id")
    .eq("id", campaignId)
    .maybeSingle();
  raiseDb(campaignError);
  if (!campaign) return null;
  const campaignRow = campaign as { name: string; document_id: string };
  const [{ data: source, error: sourceError }, { data: target, error: targetError }] = await Promise.all([
    db.from("email_documents").select("working_document").eq("id", (template as { document_id: string }).document_id).maybeSingle(),
    db.from("email_documents").select("design_system_id").eq("id", campaignRow.document_id).maybeSingle(),
  ]);
  raiseDb(sourceError);
  raiseDb(targetError);
  if (!source || !target) return null;
  const next = documentFromTemplate(
    migrateEmailDocument((source as { working_document: unknown }).working_document),
    String((target as { design_system_id: string }).design_system_id),
    campaignRow.name
  );
  const { error } = await db
    .from("email_documents")
    .update({ working_document: next, schema_version: 1, updated_at: new Date().toISOString() })
    .eq("id", campaignRow.document_id);
  raiseDb(error);
  return next;
}
