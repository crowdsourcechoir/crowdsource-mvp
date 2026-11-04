import { NextResponse } from "next/server";
import { getContact, updateContact, updateContactVerification } from "@/lib/sales/db/contacts";

export const dynamic = "force-dynamic";

/**
 * Human override: mark a contact email as verified (lime check in the queue).
 * Does not call Hunter — Joel confirms the address is good to send.
 *
 * Body `{ force: true }` overrides a Hunter bounce (`invalid`) after Joel decides
 * to send anyway (e.g. known-good published inbox Hunter mis-flagged).
 */
export async function POST(request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { contactId } = await params;
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const force = Boolean(body.force);

    const contact = await getContact(contactId);
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!contact.email) {
      return NextResponse.json({ error: "Contact has no email to verify." }, { status: 400 });
    }
    if (contact.emailVerificationStatus === "invalid" && !force) {
      return NextResponse.json(
        {
          error:
            "Hunter says this address will bounce. Pick another contact, or Override bounce to send anyway.",
          canForce: true,
        },
        { status: 409 }
      );
    }

    if (force && contact.emailVerificationStatus === "invalid") {
      const updated = await updateContact(contactId, {
        emailVerificationStatus: "verified_deliverable",
        importMetadata: {
          ...(contact.importMetadata ?? {}),
          hunterBounceOverride: true,
          hunterBounceOverrideAt: new Date().toISOString(),
          hunterBounceOverrideEmail: contact.email,
        },
      });
      return NextResponse.json({ contact: updated, forced: true });
    }

    const updated = await updateContactVerification(contactId, "verified_deliverable");
    return NextResponse.json({ contact: updated, forced: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verify failed" }, { status: 500 });
  }
}
