import { NextResponse } from "next/server";
import { getContact, updateContact } from "@/lib/sales/db/contacts";
import { updateQueueContact } from "@/lib/sales/seed/update-contact";

export const dynamic = "force-dynamic";

/**
 * Edit name / email / role on a contact (queue card mistype fix).
 * Optional `queueItemId` refreshes queue detail and mints a draft when sendable.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { contactId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      fullName?: unknown;
      email?: unknown;
      roleTitle?: unknown;
      queueItemId?: unknown;
    };
    const fullName = typeof body.fullName === "string" ? body.fullName : "";
    const email = typeof body.email === "string" ? body.email : body.email === null ? null : undefined;
    const roleTitle =
      typeof body.roleTitle === "string" ? body.roleTitle : body.roleTitle === null ? null : undefined;
    const queueItemId = typeof body.queueItemId === "string" ? body.queueItemId : null;

    if (!fullName.trim() && !(typeof email === "string" && email.trim())) {
      return NextResponse.json(
        { error: "Name or email is required." },
        { status: 400 }
      );
    }

    const result = await updateQueueContact({
      contactId,
      queueItemId,
      fullName,
      email,
      roleTitle,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = /not found/i.test(message) ? 404 : /first and last name|inbox email|required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

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
