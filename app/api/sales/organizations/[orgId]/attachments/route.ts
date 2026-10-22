import { NextResponse } from "next/server";
import { getOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import {
  isAllowedOrgAttachmentFile,
  newAttachmentId,
  normalizeHttpUrl,
  ORG_ATTACHMENT_MAX_COUNT,
  parseOrgAttachments,
  safeAttachmentFileName,
  withOrgAttachments,
  type OrgAttachment,
} from "@/lib/sales/org-attachments";

export const dynamic = "force-dynamic";

/** List attachments for an organization. */
export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const organization = await getOrganization(orgId);
    if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      attachments: parseOrgAttachments(organization.importMetadata),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

/**
 * Add a link or confirm a previously uploaded file.
 * Body:
 *   { kind: "link", url, label? }
 *   { kind: "file", attachmentId, path, fileName, contentType, sizeBytes }
 */
export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = body.kind === "file" ? "file" : body.kind === "link" ? "link" : null;
    if (!kind) {
      return NextResponse.json({ error: "Provide kind: 'link' or 'file'." }, { status: 400 });
    }

    let next: OrgAttachment;
    const now = new Date().toISOString();

    if (kind === "link") {
      const url = normalizeHttpUrl(typeof body.url === "string" ? body.url : "");
      if (!url) return NextResponse.json({ error: "Provide a valid http(s) URL." }, { status: 400 });
      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim().slice(0, 200)
          : url.replace(/^https?:\/\//i, "").slice(0, 200);
      next = {
        id: newAttachmentId(),
        kind: "link",
        url,
        label,
        createdAt: now,
      };
    } else {
      const attachmentId =
        typeof body.attachmentId === "string" && body.attachmentId.trim()
          ? body.attachmentId.trim()
          : newAttachmentId();
      const path = typeof body.path === "string" ? body.path.trim() : "";
      const fileName = safeAttachmentFileName(
        typeof body.fileName === "string" ? body.fileName : "attachment"
      );
      const contentType =
        typeof body.contentType === "string" && body.contentType.trim()
          ? body.contentType.trim()
          : "application/octet-stream";
      const sizeBytes = Number(body.sizeBytes) || 0;
      if (!path.startsWith(`sales-org-attachments/${orgId}/`)) {
        return NextResponse.json({ error: "Invalid storage path for this organization." }, { status: 400 });
      }
      if (!isAllowedOrgAttachmentFile(fileName, contentType)) {
        return NextResponse.json({ error: "File type not allowed." }, { status: 400 });
      }
      next = {
        id: attachmentId,
        kind: "file",
        fileName,
        contentType,
        sizeBytes,
        storagePath: path,
        createdAt: now,
      };
    }

    const attachments = [next, ...existing];
    const updated = await updateOrganization(orgId, {
      importMetadata: withOrgAttachments(organization.importMetadata, attachments),
    });

    return NextResponse.json({ attachment: next, organization: updated, attachments });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
