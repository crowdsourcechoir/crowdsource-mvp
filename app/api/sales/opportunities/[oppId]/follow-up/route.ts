import { NextResponse } from "next/server";
import { createOutreachActivity } from "@/lib/sales/db/activities";
import { getOpportunity, updateOpportunityTouchTimestamps } from "@/lib/sales/db/opportunities";
import {
  FOLLOW_UP_PRESETS,
  followUpAtFromPreset,
  type FollowUpPreset,
} from "@/lib/sales/outreach/extractFollowUp";

export const dynamic = "force-dynamic";

const PRESET_IDS = new Set(FOLLOW_UP_PRESETS.map((p) => p.id));

/**
 * Manually schedule (or clear) a follow-up on an opportunity.
 * Body: { preset?: "1w"|"2w"|"1m"|"3m"|"6m", followUpAt?: string|null, clear?: boolean }
 * When due, the daily nudges cron drafts a reconnect email into the approval queue (never auto-sends).
 */
export async function POST(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const opportunity = await getOpportunity(oppId);
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      preset?: string;
      followUpAt?: string | null;
      clear?: boolean;
    };

    let nextFollowUpAt: string | null;
    let source: "manual_preset" | "manual_date" | "manual_clear";

    if (body.clear === true || body.followUpAt === null) {
      nextFollowUpAt = null;
      source = "manual_clear";
    } else if (body.preset && PRESET_IDS.has(body.preset as FollowUpPreset)) {
      nextFollowUpAt = followUpAtFromPreset(body.preset as FollowUpPreset);
      source = "manual_preset";
    } else if (typeof body.followUpAt === "string" && body.followUpAt.trim()) {
      const parsed = new Date(body.followUpAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid followUpAt" }, { status: 400 });
      }
      nextFollowUpAt = parsed.toISOString();
      source = "manual_date";
    } else {
      return NextResponse.json(
        { error: "Provide preset, followUpAt, or clear: true" },
        { status: 400 }
      );
    }

    const updated = await updateOpportunityTouchTimestamps(oppId, { nextFollowUpAt });

    await createOutreachActivity({
      opportunityId: oppId,
      contactId: null,
      activityType: "note",
      metadata: {
        kind: "follow_up_scheduled",
        source,
        preset: body.preset ?? null,
        followUpAt: nextFollowUpAt,
      },
      gmailThreadId: opportunity.gmailThreadId,
    });

    return NextResponse.json({ opportunity: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
