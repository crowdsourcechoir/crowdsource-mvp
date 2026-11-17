import { NextResponse } from "next/server";
import { parkFollowUp, queueParkedDraft, returnParkedToPipeline } from "@/lib/sales/follow-up/park";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";

/**
 * High-touch follow-up. Given a date: draft the check-in, schedule a one-minute
 * calendar reminder, and park the deal. Nothing is emailed.
 * `{ clear: true }` returns it to the pipeline. `{ queue: true }` puts the saved
 * draft in the send queue for a human to approve.
 */
export async function POST(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      date?: string;
      clear?: boolean;
      queue?: boolean;
    };

    if (body.clear) {
      const opportunity = await returnParkedToPipeline(oppId);
      return NextResponse.json({
        opportunity,
        nextFollowUpAt: opportunity.nextFollowUpAt,
        parked: false,
      });
    }

    if (body.queue) {
      const queued = await queueParkedDraft(oppId);
      return NextResponse.json({
        queued: true,
        queueItemId: queued.queueItemId,
        draftId: queued.draftId,
        href: `/admin/sales/queue?funnel=parked&scope=all&item=${encodeURIComponent(queued.queueItemId)}`,
      });
    }

    if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "Pick a follow-up date" }, { status: 400 });
    }

    const result = await parkFollowUp(oppId, body.date);
    return NextResponse.json({
      parked: true,
      opportunity: result.opportunity,
      nextFollowUpAt: result.nextFollowUpAt,
      relationshipStage: result.relationshipStage,
      stagePersisted: result.stagePersisted,
      draftId: result.draftId,
      subject: result.subject,
      body: result.body,
      editionLabel: result.editionLabel,
      contactId: result.contactId,
      contactName: result.contactName,
      contactEmail: result.contactEmail,
      calendar: result.calendar,
    });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not park follow-up") }, { status: 500 });
  }
}
