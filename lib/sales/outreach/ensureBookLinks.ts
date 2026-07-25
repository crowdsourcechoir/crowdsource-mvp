import { requireSupabaseAdmin } from "../db/client";
import { bookUrl, replaceAttachmentInTemplate, replaceAttachmentWithBookLink } from "./bookUrl";

export type EnsureBookLinksResult = {
  templatesUpdated: number;
  draftsUpdated: number;
  bookUrl: string;
};

/**
 * Forces cold-outreach templates + pending/draft outreach bodies off "I've attached..."
 * and onto the branded /book URL. Safe to re-run (idempotent).
 */
export async function ensureBookLinks(): Promise<EnsureBookLinksResult> {
  const db = requireSupabaseAdmin();
  const url = bookUrl();
  let templatesUpdated = 0;
  let draftsUpdated = 0;

  const { data: templates, error: templatesError } = await db.from("outreach_templates").select("id, body_template");
  if (templatesError) throw new Error(templatesError.message);

  for (const row of templates ?? []) {
    const current = (row.body_template as string) ?? "";
    const next = replaceAttachmentInTemplate(current);
    if (next === current) continue;
    const { error } = await db
      .from("outreach_templates")
      .update({ body_template: next, updated_at: new Date().toISOString() })
      .eq("id", row.id as string);
    if (error) throw new Error(error.message);
    templatesUpdated += 1;
  }

<<<<<<< HEAD
  // Rewrite non-terminal drafts still carrying attachment language (ASCII or curly apostrophe).
  const { data: drafts, error: draftsError } = await db
    .from("outreach_drafts")
    .select("id, ai_body, edited_body, status")
    .in("status", ["draft", "qa_flagged", "qa_passed"])
    .or("ai_body.ilike.%attached a one-page%,edited_body.ilike.%attached a one-page%");
=======
  // Rewrite non-terminal drafts; content filter is applied in JS so spaces/apostrophes
  // in "I've attached..." can't break the PostgREST `.or()` filter parser.
  const { data: drafts, error: draftsError } = await db
    .from("outreach_drafts")
    .select("id, ai_body, edited_body, status")
    .in("status", ["draft", "qa_flagged", "qa_passed"]);
>>>>>>> main
  if (draftsError) throw new Error(draftsError.message);

  for (const row of drafts ?? []) {
    const aiBody = (row.ai_body as string) ?? "";
    const editedBody = (row.edited_body as string | null) ?? null;
    const nextAi = replaceAttachmentWithBookLink(aiBody, url);
    const nextEdited = editedBody ? replaceAttachmentWithBookLink(editedBody, url) : null;
    if (nextAi === aiBody && nextEdited === editedBody) continue;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (nextAi !== aiBody) patch.ai_body = nextAi;
    if (editedBody && nextEdited !== editedBody) patch.edited_body = nextEdited;
    const { error } = await db.from("outreach_drafts").update(patch).eq("id", row.id as string);
    if (error) throw new Error(error.message);
    draftsUpdated += 1;
  }

  return { templatesUpdated, draftsUpdated, bookUrl: url };
}
