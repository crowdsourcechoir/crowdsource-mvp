import { NextResponse } from "next/server";
import { getOrganization } from "@/lib/sales/db/organizations";
import {
  isAllowedOrgAttachmentFile,
  newAttachmentId,
  ORG_ATTACHMENT_BUCKET,
  ORG_ATTACHMENT_MAX_BYTES,
  ORG_ATTACHMENT_MAX_COUNT,
  orgAttachmentStoragePath,
  parseOrgAttachments,
  safeAttachmentFileName,
} from "@/lib/sales/org-attachments";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Prepare a signed upload slot for an org attachment (PDF / Keynote / PPTX / …).
 * Client PUTs the file to signedUrl, then POSTs /attachments to confirm.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
    }

    const { orgId } = await params;
    const organization = await getOrganization(orgId);
    if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = parseOrgAttachments(organization.importMetadata);
    if (existing.length >= ORG_ATTACHMENT_MAX_COUNT) {
      return NextResponse.json(
        { error: `At most ${ORG_ATTACHMENT_MAX_COUNT} attachments per organization.` },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      contentType?: string;
      size?: number;
    };
    const fileName = safeAttachmentFileName(typeof body.name === "string" ? body.name : "attachment");
    const contentType =
      typeof body.contentType === "string" && body.contentType.trim()
        ? body.contentType.trim()
        : "application/octet-stream";
    const size = Number(body.size) || 0;

    if (size <= 0 || size > ORG_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `File must be under ${Math.round(ORG_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB.`,
        },
        { status: 400 }
      );
    }
    if (!isAllowedOrgAttachmentFile(fileName, contentType)) {
      return NextResponse.json(
        { error: "Allowed files: PDF, Keynote, PowerPoint, Word, Excel, images, or plain text." },
        { status: 400 }
      );
    }

    const attachmentId = newAttachmentId();
    const path = orgAttachmentStoragePath(orgId, attachmentId, fileName);
    const { data, error } = await supabaseAdmin.storage
      .from(ORG_ATTACHMENT_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Could not create upload URL." }, { status: 500 });
    }

    return NextResponse.json({
      upload: {
        attachmentId,
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
        contentType,
        fileName,
      },
      maxBytes: ORG_ATTACHMENT_MAX_BYTES,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
