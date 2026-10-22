import { NextResponse } from "next/server";
import { getOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import {
  ORG_ATTACHMENT_BUCKET,
  parseOrgAttachments,
  withOrgAttachments,
} from "@/lib/sales/org-attachments";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** Remove an attachment (and its storage object when kind=file). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; attachmentId: string }> }
) {
  try {
    const { orgId, attachmentId } = await params;
    const organization = await getOrganization(orgId);
    if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = parseOrgAttachments(organization.importMetadata);
    const target = existing.find((a) => a.id === attachmentId);
    if (!target) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    if (target.kind === "file" && supabaseAdmin) {
      await supabaseAdmin.storage.from(ORG_ATTACHMENT_BUCKET).remove([target.storagePath]).catch(() => undefined);
    }

    const attachments = existing.filter((a) => a.id !== attachmentId);
    const updated = await updateOrganization(orgId, {
      importMetadata: withOrgAttachments(organization.importMetadata, attachments),
    });

    return NextResponse.json({ organization: updated, attachments });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
