import { NextResponse } from "next/server";
import { markFollowUpsLost, snoozeFollowUps } from "@/lib/sales/db/follow-ups";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_BATCH = 50;

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0)));
}

/**
 * Batch snooze / mark lost. Send is never here — each send still goes through
 * POST /api/sales/queue/:id/decision with confirmed: true (one Gmail send per contact).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action as string;
    const opportunityIds = parseIds(body?.opportunityIds);
    if (opportunityIds.length === 0) {
      return NextResponse.json({ error: "Select at least one follow-up." }, { status: 400 });
    }
    if (opportunityIds.length > MAX_BATCH) {
      return NextResponse.json({ error: `Select at most ${MAX_BATCH} at a time.` }, { status: 400 });
    }

    if (action === "snooze") {
      const days = typeof body?.days === "number" && body.days > 0 ? Math.min(30, Math.floor(body.days)) : 7;
      const result = await snoozeFollowUps(opportunityIds, days);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "lost") {
      const result = await markFollowUpsLost(opportunityIds);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      { error: "Unknown action. Use snooze or lost — send stays on the queue decision with confirmation." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Follow-up action failed") }, { status: 500 });
  }
}
