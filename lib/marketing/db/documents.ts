import type { EmailDocument } from "../document/types";
import { marketingDb } from "./client";
import { raiseDb } from "./errors";

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
