import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { addContactFromBusinessCard } from "@/lib/sales/seed/add-from-card";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Save a reviewed card extract → org + contact in Interest (queue when email is sendable). */
export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const result = await addContactFromBusinessCard({
      fullName: typeof body?.fullName === "string" ? body.fullName : null,
      roleTitle: typeof body?.roleTitle === "string" ? body.roleTitle : null,
      organizationName: typeof body?.organizationName === "string" ? body.organizationName : null,
      email: typeof body?.email === "string" ? body.email : null,
      phone: typeof body?.phone === "string" ? body.phone : null,
      websiteUrl: typeof body?.websiteUrl === "string" ? body.websiteUrl : null,
      linkedinUrl: typeof body?.linkedinUrl === "string" ? body.linkedinUrl : null,
      notes: typeof body?.notes === "string" ? body.notes : null,
      confidence: typeof body?.confidence === "number" ? body.confidence : 0,
      salesInitiative: typeof body?.salesInitiative === "string" ? body.salesInitiative : null,
      eventName: typeof body?.eventName === "string" ? body.eventName : null,
    });
    return NextResponse.json({
      organizationId: result.organization.id,
      organizationName: result.organization.name,
      contactId: result.contact.id,
      contactName: result.contact.fullName,
      opportunityId: result.opportunityId,
      relationshipStage: result.relationshipStage,
      queued: result.queued,
      queueItemId: result.queueItemId,
      message: result.message,
      createdOrganization: result.createdOrganization,
      createdContact: result.createdContact,
    });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not save card contact") }, { status: 500 });
  }
}
