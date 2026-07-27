import { NextResponse } from "next/server";
import { ensureEmailSignatures } from "@/lib/sales/outreach/ensureSignatures";

export const dynamic = "force-dynamic";

/** One-shot: append the Crowdsource Choir signature to templates + pending drafts. Idempotent. */
export async function POST() {
  try {
    const result = await ensureEmailSignatures();
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
