import { NextResponse } from "next/server";
import { getOpportunity, updateOpportunityTouchTimestamps } from "@/lib/sales/db/opportunities";
import { followUpFromDateInput, followUpPresetIso, type FollowUpPreset } from "@/lib/sales/follow-up/calendar";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";

const PRESETS = new Set<FollowUpPreset>(["today", "tomorrow", "in_3_days", "next_week"]);

export async function POST(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const opportunity = await getOpportunity(oppId);
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      preset?: string;
      at?: string | null;
      date?: string | null;
      clear?: boolean;
    };

    let nextFollowUpAt: string | null;
    if (body.clear || body.at === null || body.date === null) {
      nextFollowUpAt = null;
    } else if (typeof body.preset === "string" && PRESETS.has(body.preset as FollowUpPreset)) {
      nextFollowUpAt = followUpPresetIso(body.preset as FollowUpPreset);
    } else if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      nextFollowUpAt = followUpFromDateInput(body.date);
      if (!nextFollowUpAt) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    } else if (typeof body.at === "string" && body.at.trim()) {
      const parsed = new Date(body.at);
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
      nextFollowUpAt = parsed.toISOString();
    } else {
      return NextResponse.json({ error: "Provide preset, date, or at" }, { status: 400 });
    }

    const updated = await updateOpportunityTouchTimestamps(oppId, { nextFollowUpAt });
    return NextResponse.json({ opportunity: updated, nextFollowUpAt: updated.nextFollowUpAt });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to set follow-up") }, { status: 500 });
  }
}
