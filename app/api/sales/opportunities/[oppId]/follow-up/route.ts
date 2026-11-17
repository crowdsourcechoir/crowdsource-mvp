import { NextResponse } from "next/server";
import { getOrganization } from "@/lib/sales/db/organizations";
import {
  getOpportunity,
  updateOpportunityImportMetadata,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { followUpFromDateInput, followUpPresetIso, ymdInSalesZone, type FollowUpPreset } from "@/lib/sales/follow-up/calendar";
import { syncFollowUpCalendarEvent } from "@/lib/sales/follow-up/gmail-event";
import { returnParkedToPipeline } from "@/lib/sales/follow-up/park";
import { readParkedFollowUp, withParkedFollowUp, type ParkedFollowUpRecord } from "@/lib/sales/follow-up/parked";
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

    const parked = readParkedFollowUp(opportunity.importMetadata);
    if ((body.clear || body.at === null || body.date === null) && parked) {
      const released = await returnParkedToPipeline(oppId);
      return NextResponse.json({
        opportunity: released,
        nextFollowUpAt: released.nextFollowUpAt,
        calendarWarning: null,
      });
    }

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
    const existingEventId =
      typeof opportunity.importMetadata?.followUpCalendarEventId === "string"
        ? opportunity.importMetadata.followUpCalendarEventId
        : null;
    const organization = await getOrganization(opportunity.organizationId);
    let synced: { eventId: string | null; warning: string | null } = {
      eventId: existingEventId,
      warning: null,
    };
    try {
      synced = await syncFollowUpCalendarEvent({
        opportunityId: oppId,
        organizationName: organization?.name ?? opportunity.title,
        organizationId: organization?.id ?? null,
        whenIso: updated.nextFollowUpAt,
        existingEventId,
        summary: parked ? `Check in — ${parked.editionLabel}` : null,
        description: parked?.calendarDescription ?? null,
        contactName: parked?.contactName ?? null,
        contactEmail: parked?.contactEmail ?? null,
      });
    } catch (err) {
      synced = {
        eventId: existingEventId,
        warning: `Follow-up saved. Calendar was not updated (${publicErrorMessage(err, "calendar error")}).`,
      };
    }
    const rescheduled: ParkedFollowUpRecord | null =
      parked && updated.nextFollowUpAt ? { ...parked, followUpOn: ymdInSalesZone(updated.nextFollowUpAt) } : null;
    let saved = updated;
    if (synced.eventId !== existingEventId || rescheduled) {
      saved = await updateOpportunityImportMetadata(
        oppId,
        rescheduled
          ? withParkedFollowUp(updated.importMetadata, rescheduled, synced.eventId)
          : { ...(updated.importMetadata ?? {}), followUpCalendarEventId: synced.eventId }
      );
    }
    return NextResponse.json({
      opportunity: saved,
      nextFollowUpAt: saved.nextFollowUpAt,
      calendarWarning: synced.warning,
    });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to set follow-up") }, { status: 500 });
  }
}
