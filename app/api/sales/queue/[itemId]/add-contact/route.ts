import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { addContactToQueueItem } from "@/lib/sales/seed/add-manual";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Add a named contact to the org on this queue item. Hunter finds email if missing. */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const { itemId } = await params;
    const body = await request.json();
    const result = await addContactToQueueItem({
      itemId,
      fullName: typeof body?.fullName === "string" ? body.fullName : "",
      email: typeof body?.email === "string" ? body.email : null,
      roleTitle: typeof body?.roleTitle === "string" ? body.roleTitle : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not add contact") }, { status: 400 });
  }
}
