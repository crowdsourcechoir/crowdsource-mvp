import { NextResponse } from "next/server";
import { generateDueNudgeDrafts } from "@/lib/sales/gmail/nudge";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual nudge-draft generation trigger from the admin UI. */
export async function POST() {
  try {
    const result = await generateDueNudgeDrafts();
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
