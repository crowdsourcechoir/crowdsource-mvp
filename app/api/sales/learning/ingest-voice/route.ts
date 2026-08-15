import { NextResponse } from "next/server";
import { createOutreachFeedback } from "@/lib/sales/db/feedback";
import { getOpportunity } from "@/lib/sales/db/opportunities";
import { getOrganization } from "@/lib/sales/db/organizations";
import { getContact } from "@/lib/sales/db/contacts";
import { resolveIndustrySegmentIdForOrganization } from "@/lib/sales/db/lookups";
import { buildSeahawksEmail, classifySportsDoorway } from "@/lib/sales/outreach/sports-voice";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";

export const dynamic = "force-dynamic";

/**
 * Ingest Joel’s accepted email voice as outreach_feedback WITHOUT sending.
 * Used after he writes/sends outside the queue (or before Approve) so future drafts learn.
 *
 * Body: {
 *   opportunityId: string,
 *   examples: Array<{
 *     contactId?: string,
 *     contactEmail?: string,
 *     firstName?: string,
 *     roleTitle?: string,
 *     outreachPersona?: OutreachPersona,
 *     editedSubject: string,
 *     editedBody: string,
 *     originalSubject?: string,
 *     originalBody?: string,
 *   }>
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const opportunityId = typeof body?.opportunityId === "string" ? body.opportunityId : "";
    if (!opportunityId) {
      return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
    }
    const opportunity = await getOpportunity(opportunityId);
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    const organization = await getOrganization(opportunity.organizationId);
    if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const industrySegmentId = await resolveIndustrySegmentIdForOrganization(organization);

    const examples = Array.isArray(body?.examples) ? body.examples : [];
    if (examples.length === 0) {
      return NextResponse.json({ error: "examples[] required" }, { status: 400 });
    }

    const learned: { contactId: string | null; email: string | null; feedbackId: string }[] = [];
    const skipped: { reason: string; email?: string }[] = [];

    for (const ex of examples) {
      const editedSubject = typeof ex?.editedSubject === "string" ? ex.editedSubject.trim() : "";
      const editedBody = typeof ex?.editedBody === "string" ? ex.editedBody.trim() : "";
      if (!editedSubject || !editedBody) {
        skipped.push({ reason: "missing subject/body" });
        continue;
      }

      let contact = ex?.contactId ? await getContact(ex.contactId) : null;
      if (!contact && typeof ex?.contactEmail === "string") {
        // Lightweight: caller should pass contactId when possible; email alone is for skip checks.
        if (isOutboundEmailBlocked(ex.contactEmail)) {
          skipped.push({ reason: "hard-blocked email", email: ex.contactEmail });
          continue;
        }
      }
      if (contact?.email && isOutboundEmailBlocked(contact.email)) {
        skipped.push({ reason: "hard-blocked email", email: contact.email });
        continue;
      }

      const originalSubject =
        typeof ex?.originalSubject === "string" && ex.originalSubject.trim()
          ? ex.originalSubject.trim()
          : `${organization.name} — shared-creation anthem for training camp / fan ritual`;
      const originalBody =
        typeof ex?.originalBody === "string" && ex.originalBody.trim()
          ? ex.originalBody.trim()
          : "[prior stub draft]";

      const feedback = await createOutreachFeedback({
        opportunityId,
        contactId: contact?.id ?? null,
        opportunityTypeId: opportunity.opportunityTypeId,
        industrySegmentId,
        outreachPersona: (typeof ex?.outreachPersona === "string" ? ex.outreachPersona : null) ?? contact?.outreachPersona ?? null,
        decision: "approved_with_edits",
        originalSubject,
        originalBody,
        editedSubject,
        editedBody,
      });
      learned.push({
        contactId: contact?.id ?? null,
        email: contact?.email ?? (typeof ex?.contactEmail === "string" ? ex.contactEmail : null),
        feedbackId: feedback.id,
      });
    }

    return NextResponse.json({
      ok: true,
      learnedCount: learned.length,
      learned,
      skipped,
      tip: "Few-shots load on next AI draft for matching persona/segment. Manual sports drafts use buildSeahawksEmail.",
      sampleDoorways: {
        coo: classifySportsDoorway("Chief Operating Officer"),
        entertainment: classifySportsDoorway("Manager, Entertainment Experience & Programming"),
      },
      previewRyan: buildSeahawksEmail({
        firstName: "Ryan",
        roleTitle: "Reports to COO / Operations",
      }).subject,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
