import { NextResponse } from "next/server";
import { loadFollowUpPage } from "@/lib/sales/db/follow-ups";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  try {
    const page = await loadFollowUpPage();
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load follow-ups") }, { status: 500 });
  }
}
