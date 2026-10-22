import { NextResponse } from "next/server";
import { getOrganization } from "@/lib/sales/db/organizations";
import { ORG_ATTACHMENT_BUCKET, parseOrgAttachments } from "@/lib/sales/org-attachments";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** Authenticated download (or short-lived signed redirect) for a file attachment. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string; attachmentId: string }> }
) {
  try {
    const { orgId, attachmentId } = await params;
    const organization = await getOrganization(orgId);
    if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const target = parseOrgAttachments(organization.importMetadata).find((a) => a.id === attachmentId);
    if (!target) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    if (target.kind === "link") {
      return NextResponse.redirect(target.url);
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
    }

    const redirect = new URL(request.url).searchParams.get("redirect") === "1";
    if (redirect) {
      const { data, error } = await supabaseAdmin.storage
        .from(ORG_ATTACHMENT_BUCKET)
        .createSignedUrl(target.storagePath, 60 * 10);
      if (error || !data?.signedUrl) {
        return NextResponse.json({ error: error?.message ?? "Could not sign download URL." }, { status: 500 });
      }
      return NextResponse.redirect(data.signedUrl);
    }

    const { data, error } = await supabaseAdmin.storage.from(ORG_ATTACHMENT_BUCKET).download(target.storagePath);
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Download failed" }, { status: 500 });
    }
    const buf = Buffer.from(await data.arrayBuffer());
    const safeName = target.fileName.replace(/"/g, "");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": target.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
