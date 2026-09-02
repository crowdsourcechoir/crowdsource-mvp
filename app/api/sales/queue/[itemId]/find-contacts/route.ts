import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { publicErrorMessage } from "@/lib/sales/http-error";
import { findMoreContactsForQueueItem } from "@/lib/sales/seed/find-more-contacts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Find more contacts for this queue org via Hunter Domain Search. */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await findMoreContactsForQueueItem({
      itemId,
      query: typeof body?.query === "string" ? body.query : "",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not find contacts") }, { status: 400 });
  }
}
