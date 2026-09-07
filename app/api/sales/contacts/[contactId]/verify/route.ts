import { NextResponse } from "next/server";
import { getContact, updateContactVerification } from "@/lib/sales/db/contacts";

export const dynamic = "force-dynamic";

/**
 * Human override: mark a contact email as verified (lime check in the queue).
 * Does not call Hunter — Joel confirms the address is good to send.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { contactId } = await params;
    const contact = await getContact(contactId);
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!contact.email) {
      return NextResponse.json({ error: "Contact has no email to verify." }, { status: 400 });
    }
    if (contact.emailVerificationStatus === "invalid") {
      return NextResponse.json(
        { error: "This address bounced — pick another contact instead of forcing verify." },
        { status: 409 }
      );
    }
    const updated = await updateContactVerification(contactId, "verified_deliverable");
    return NextResponse.json({ contact: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verify failed" }, { status: 500 });
  }
}
