import { NextResponse } from "next/server";
import { getQueueItem } from "@/lib/sales/db/queue";
import { getDraft, updateDraftEdits } from "@/lib/sales/db/outreach";
import { getOpportunity } from "@/lib/sales/db/opportunities";
import { getOrganization } from "@/lib/sales/db/organizations";
import { getContact } from "@/lib/sales/db/contacts";
import { improveOutreachDraft } from "@/lib/sales/outreach/improve-draft";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import { draftToPlainText, coalesceDraftBody } from "@/lib/sales/outreach/email-body-format";
import { readSalesInitiative } from "@/lib/sales/initiatives";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rewrite the current queue draft via OpenAI. Saves as edited copy. Never sends.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.status !== "pending") {
      return NextResponse.json({ error: "Queue item already decided." }, { status: 409 });
    }
    if (!item.outreachDraftId) {
      return NextResponse.json({ error: "No draft on this queue item." }, { status: 400 });
    }

    const draft = await getDraft(item.outreachDraftId);
    if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    const opportunity = await getOpportunity(item.opportunityId);
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    const organization = await getOrganization(opportunity.organizationId);
    if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const contact = draft.contactId ? await getContact(draft.contactId) : null;

    const currentSubject =
      typeof body?.subject === "string" && body.subject.trim()
        ? body.subject
        : (draft.editedSubject ?? draft.aiSubject);
    const currentBody = draftToPlainText(
      typeof body?.body === "string" && body.body.trim()
        ? body.body
        : stripEmailSignature(coalesceDraftBody(draft.editedBody, draft.aiBody))
    );

    const initiative = readSalesInitiative(organization.importMetadata);
    const initiativeHint =
      initiative === "sports_fan_culture" || /sport|team|athletics|seahawk|sounder|kraken/i.test(organization.name)
        ? "sports"
        : initiative === "conferences_associations" || /conference|association/i.test(opportunity.title)
          ? "conference"
          : "unknown";

    const improved = await improveOutreachDraft({
      subject: currentSubject,
      body: currentBody,
      contactFirstName: (contact?.fullName ?? "there").split(/\s+/)[0],
      contactRoleTitle: contact?.roleTitle ?? null,
      organizationName: organization.name,
      opportunityTitle: opportunity.title,
      initiativeHint,
    });

    const saved = await updateDraftEdits(draft.id, {
      editedSubject: improved.subject,
      editedBody: improved.body,
    });
    return NextResponse.json({ draft: saved, sent: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Improve failed" }, { status: 500 });
  }
}
