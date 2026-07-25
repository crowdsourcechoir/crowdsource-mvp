import { requireSupabaseAdmin } from "../db/client";
import { bookUrl, replaceAttachmentInTemplate, replaceAttachmentWithBookLink } from "./bookUrl";

export type EnsureBookLinksResult = {
  templatesUpdated: number;
  draftsUpdated: number;
  bookUrl: string;
  draftsScanned: number;
  draftsAlreadyLinked: number;
  sampleUnchangedWithAttach: string | null;
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
  let draftsAlreadyLinked = 0;
  let sampleUnchangedWithAttach: string | null = null;

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
  // Rewrite non-terminal drafts; content filter is applied in JS so spaces/apostrophes
  // in "I've attached..." can't break the PostgREST `.or()` filter parser.
  const { data: drafts, error: draftsError } = await db
    .from("outreach_drafts")
    .select("id, ai_body, edited_body, status")
    .in("status", ["draft", "qa_flagged", "qa_passed"]);
  if (draftsError) throw new Error(draftsError.message);
=======
  // Page through all non-terminal drafts (PostgREST default max-rows can otherwise truncate).
  const pageSize = 200;
  let from = 0;
  let draftsScanned = 0;
  for (;;) {
    const { data: drafts, error: draftsError } = await db
      .from("outreach_drafts")
      .select("id, ai_body, edited_body, status")
      .in("status", ["draft", "qa_flagged", "qa_passed"])
      .range(from, from + pageSize - 1);
    if (draftsError) throw new Error(draftsError.message);
    const page = drafts ?? [];
    if (page.length === 0) break;
>>>>>>> 8a2186d (Diagnose ensure-book-links and allow forcing draft IDs)

    for (const row of page) {
      draftsScanned += 1;
      const aiBody = (row.ai_body as string) ?? "";
      const editedBody = (row.edited_body as string | null) ?? null;
      const nextAi = replaceAttachmentWithBookLink(aiBody, url);
      const nextEdited = editedBody ? replaceAttachmentWithBookLink(editedBody, url) : null;
      if (nextAi === aiBody && nextEdited === editedBody) {
        if (/crowdsourcechoir\.com\/book/i.test(aiBody)) draftsAlreadyLinked += 1;
        if (!sampleUnchangedWithAttach && /attached a one-page/i.test(aiBody)) {
          sampleUnchangedWithAttach = `${row.id as string}:${JSON.stringify(aiBody.match(/I.ve attached[^\n.]{0,60}/)?.[0] ?? "").slice(0, 120)}`;
        }
        continue;
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (nextAi !== aiBody) patch.ai_body = nextAi;
      if (editedBody && nextEdited !== editedBody) patch.edited_body = nextEdited;
      const { error } = await db.from("outreach_drafts").update(patch).eq("id", row.id as string);
      if (error) throw new Error(error.message);
      draftsUpdated += 1;
    }

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return {
    templatesUpdated,
    draftsUpdated,
    bookUrl: url,
    draftsScanned,
    draftsAlreadyLinked,
    sampleUnchangedWithAttach,
  };
}
