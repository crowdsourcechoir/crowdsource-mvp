import { NextResponse } from "next/server";
import { getQueueItem, setQueueItemOutreachDraft } from "@/lib/sales/db/queue";
import { getOpportunity } from "@/lib/sales/db/opportunities";
import { getOrganization } from "@/lib/sales/db/organizations";
import { getContact, updateContactVerification } from "@/lib/sales/db/contacts";
import { listDraftsForOpportunity } from "@/lib/sales/db/outreach";
import { ensureContactDrafts } from "@/lib/sales/seed/enqueue-manual";
import { hasSelectableOutreachEmail, hasVerifiedEmail, looksLikePersonName } from "@/lib/sales/dedupe";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";

export const dynamic = "force-dynamic";

/**
 * Switch the active queue draft to a specific org contact (creates a draft if missing).
 * Returns a slim payload so the queue UI can stay snappy.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const contactId = typeof body?.contactId === "string" ? body.contactId : "";
    if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });

    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.status !== "pending") {
      return NextResponse.json({ error: "Queue item already decided." }, { status: 409 });
    }

    const opportunity = await getOpportunity(item.opportunityId);
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    const [loadedContact, existingDraftsRaw] = await Promise.all([
      getContact(contactId),
      listDraftsForOpportunity(opportunity.id),
    ]);
    const existingDrafts = existingDraftsRaw ?? [];
    if (!loadedContact || loadedContact.organizationId !== opportunity.organizationId) {
      return NextResponse.json({ error: "Contact not on this organization" }, { status: 400 });
    }
    if (loadedContact.duplicateOfContactId) {
      return NextResponse.json({ error: "Contact is hidden from this queue item" }, { status: 400 });
    }
    // The picker already showed anyone with a name + email. Domain-mismatch `risky`
    // (e.g. @uw.edu on gohuskies.com) must still be clickable — that's the human override.
    if (!looksLikePersonName(loadedContact.fullName) || !hasSelectableOutreachEmail(loadedContact)) {
      return NextResponse.json({ error: "Contact needs a name and verified-format email" }, { status: 400 });
    }
    const email = loadedContact.email;
    if (!email || isOutboundEmailBlocked(email)) {
      return NextResponse.json(
        { error: `Hard block: ${email ?? "this address"} cannot be selected for outbound.`, blocked: true },
        { status: 403 }
      );
    }
    if (!hasVerifiedEmail(loadedContact)) {
      await updateContactVerification(loadedContact.id, "valid_format");
    }

    let draft =
      [...existingDrafts]
        .reverse()
        .find((d) => d.kind === "initial" && d.contactId === contactId) ?? null;

    if (!draft) {
      const organization = await getOrganization(opportunity.organizationId);
      if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      const created = await ensureContactDrafts({
        organization,
        opportunityId: opportunity.id,
        pipelineRunId: null,
        contactIds: [contactId],
      });
      draft = (created?.drafts ?? []).find((d) => d.contactId === contactId) ?? created?.primaryDraft ?? null;
    }
    if (!draft) return NextResponse.json({ error: "Could not create draft for contact" }, { status: 500 });

    await setQueueItemOutreachDraft(itemId, draft.id);
    return NextResponse.json({ draftId: draft.id, contactId, draft });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
