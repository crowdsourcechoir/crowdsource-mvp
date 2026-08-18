import { NextResponse } from "next/server";
import { getContact, updateContact } from "@/lib/sales/db/contacts";

export const dynamic = "force-dynamic";

/** Hide a contact from the queue picker. Does not send. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { contactId } = await params;
    const contact = await getContact(contactId);
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await updateContact(contactId, {
      duplicateOfContactId: contact.duplicateOfContactId ?? contactId,
    });
    return NextResponse.json({ contact: updated, hidden: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 500 });
  }
}
