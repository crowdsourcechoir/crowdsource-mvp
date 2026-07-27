import { requireSupabaseAdmin } from "../db/client";
import { ensureEmailSignature, hasEmailSignature } from "./signature";

export type EnsureEmailSignaturesResult = {
  templatesUpdated: number;
  draftsUpdated: number;
  draftsScanned: number;
  draftsAlreadySigned: number;
};

/**
 * Appends the Crowdsource Choir press-quote signature after "Best,\nJoel" on all outreach
 * templates and non-terminal drafts. Idempotent — safe to re-run.
 */
export async function ensureEmailSignatures(): Promise<EnsureEmailSignaturesResult> {
  const db = requireSupabaseAdmin();
  let templatesUpdated = 0;
  let draftsUpdated = 0;
  let draftsAlreadySigned = 0;
  let draftsScanned = 0;

  const { data: templates, error: templatesError } = await db.from("outreach_templates").select("id, body_template");
  if (templatesError) throw new Error(templatesError.message);

  for (const row of templates ?? []) {
    const current = (row.body_template as string) ?? "";
    const next = ensureEmailSignature(current);
    if (next === current) continue;
    const { error } = await db
      .from("outreach_templates")
      .update({ body_template: next, updated_at: new Date().toISOString() })
      .eq("id", row.id as string);
    if (error) throw new Error(error.message);
    templatesUpdated += 1;
  }

  const pageSize = 200;
  let from = 0;
  for (;;) {
    const { data: drafts, error: draftsError } = await db
      .from("outreach_drafts")
      .select("id, ai_body, edited_body, status")
      .in("status", ["draft", "qa_flagged", "qa_passed"])
      .range(from, from + pageSize - 1);
    if (draftsError) throw new Error(draftsError.message);
    const page = drafts ?? [];
    if (page.length === 0) break;

    for (const row of page) {
      draftsScanned += 1;
      const aiBody = (row.ai_body as string) ?? "";
      const editedBody = (row.edited_body as string | null) ?? null;
      const nextAi = ensureEmailSignature(aiBody);
      const nextEdited = editedBody ? ensureEmailSignature(editedBody) : null;
      if (nextAi === aiBody && nextEdited === editedBody) {
        if (hasEmailSignature(aiBody)) draftsAlreadySigned += 1;
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

  return { templatesUpdated, draftsUpdated, draftsScanned, draftsAlreadySigned };
}
