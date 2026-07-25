import { NextResponse } from "next/server";
import { ensureBookLinks } from "@/lib/sales/outreach/ensureBookLinks";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { bookUrl, replaceAttachmentWithBookLink } from "@/lib/sales/outreach/bookUrl";

export const dynamic = "force-dynamic";

/**
 * One-shot: rewrite outreach templates + non-terminal drafts off "I've attached..."
 * onto https://www.crowdsourcechoir.com/book. Idempotent.
 *
 * Optional body: `{ "draftIds": ["..."] }` to force-refresh specific draft rows.
 */
export async function POST(request: Request) {
  try {
    const result = await ensureBookLinks();
    let forcedUpdated = 0;
    try {
      const body = (await request.json()) as { draftIds?: string[] };
      const draftIds = Array.isArray(body?.draftIds) ? body.draftIds.filter((id) => typeof id === "string") : [];
      if (draftIds.length > 0) {
        const db = requireSupabaseAdmin();
        const url = bookUrl();
        const { data, error } = await db.from("outreach_drafts").select("id, ai_body, edited_body").in("id", draftIds);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) {
          const nextAi = replaceAttachmentWithBookLink((row.ai_body as string) ?? "", url);
          const edited = (row.edited_body as string | null) ?? null;
          const nextEdited = edited ? replaceAttachmentWithBookLink(edited, url) : null;
          const { error: updateError } = await db
            .from("outreach_drafts")
            .update({
              ai_body: nextAi,
              ...(edited ? { edited_body: nextEdited } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id as string);
          if (updateError) throw new Error(updateError.message);
          forcedUpdated += 1;
        }
      }
    } catch (parseErr) {
      // No/invalid JSON body is fine — ensureBookLinks alone still ran.
      if (forcedUpdated === 0 && parseErr instanceof Error && !/Unexpected|JSON|body/i.test(parseErr.message)) {
        // only ignore JSON parse; rethrow DB errors from the force path
        if (!/invalid|Unexpected end|JSON/i.test(parseErr.message)) throw parseErr;
      }
    }
    return NextResponse.json({ ...result, forcedUpdated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
