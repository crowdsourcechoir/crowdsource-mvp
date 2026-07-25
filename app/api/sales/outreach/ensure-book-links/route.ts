import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { bookUrl, replaceAttachmentWithBookLink } from "@/lib/sales/outreach/bookUrl";
import { ensureBookLinks } from "@/lib/sales/outreach/ensureBookLinks";

export const dynamic = "force-dynamic";

/**
 * One-shot: rewrite outreach templates + non-terminal drafts off "I've attached..."
 * onto https://www.crowdsourcechoir.com/book. Idempotent.
 *
 * Optional JSON body: `{ "draftIds": ["..."] }` to force-refresh specific draft rows.
 */
export async function POST(request: Request) {
  try {
    const result = await ensureBookLinks();

    let forcedUpdated = 0;
    let raw: unknown = null;
    try {
      raw = await request.json();
    } catch {
      raw = null;
    }
    const draftIds =
      raw && typeof raw === "object" && Array.isArray((raw as { draftIds?: unknown }).draftIds)
        ? ((raw as { draftIds: unknown[] }).draftIds.filter((id) => typeof id === "string") as string[])
        : [];

    const forceDetails: {
      id: string;
      changed: boolean;
      hadAttach: boolean;
      hasBookAfter: boolean;
      beforeSnippet: string | null;
      afterSnippet: string | null;
      updatedAt: string | null;
    }[] = [];
    if (draftIds.length > 0) {
      const db = requireSupabaseAdmin();
      const url = bookUrl();
      const { data, error } = await db.from("outreach_drafts").select("id, ai_body, edited_body").in("id", draftIds);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const aiBody = (row.ai_body as string) ?? "";
        const nextAi = replaceAttachmentWithBookLink(aiBody, url);
        const edited = (row.edited_body as string | null) ?? null;
        const nextEdited = edited ? replaceAttachmentWithBookLink(edited, url) : null;
        const changed = nextAi !== aiBody || (edited !== null && nextEdited !== edited);
        const { data: updated, error: updateError } = await db
          .from("outreach_drafts")
          .update({
            ai_body: nextAi,
            ...(edited ? { edited_body: nextEdited } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id as string)
          .select("id, updated_at, ai_body")
          .maybeSingle();
        if (updateError) throw new Error(updateError.message);
        if (updated) forcedUpdated += 1;
        const afterBody = (updated?.ai_body as string) ?? "";
        forceDetails.push({
          id: row.id as string,
          changed,
          hadAttach: /attached a one-page/i.test(aiBody),
          hasBookAfter: /crowdsourcechoir\.com\/book/i.test(afterBody),
          beforeSnippet: aiBody.match(/I['\u2019]ve (?:attached|included)[^\n]{0,70}/)?.[0] ?? null,
          afterSnippet: afterBody.match(/I['\u2019]ve (?:attached|included)[^\n]{0,70}/)?.[0] ?? null,
          updatedAt: (updated?.updated_at as string) ?? null,
        });
      }
    }

    return NextResponse.json({ ...result, forcedUpdated, forceDetails });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
