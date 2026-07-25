import { NextResponse } from "next/server";
import { ensureBookLinks } from "@/lib/sales/outreach/ensureBookLinks";

export const dynamic = "force-dynamic";

/**
 * One-shot: rewrite outreach templates + non-terminal drafts off "I've attached..."
 * onto https://www.crowdsourcechoir.com/book. Idempotent.
 */
export async function POST() {
  try {
    const result = await ensureBookLinks();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
