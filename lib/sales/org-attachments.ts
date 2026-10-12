/**
 * Organization attachments stored on import_metadata.attachments.
 * Links (Google Doc / Drive / etc.) + uploaded files (PDF, Keynote, PPTX, …).
 */

export const ORG_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ORG_ATTACHMENT_MAX_COUNT = 20;
export const ORG_ATTACHMENT_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";

export type OrgLinkAttachment = {
  id: string;
  kind: "link";
  url: string;
  label: string;
  createdAt: string;
};

export type OrgFileAttachment = {
  id: string;
  kind: "file";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
};

export type OrgAttachment = OrgLinkAttachment | OrgFileAttachment;

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/vnd.apple.keynote",
  "application/x-iwork-keynote-sffkey",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "key",
  "keynote",
  "pptx",
  "ppt",
  "docx",
  "doc",
  "xlsx",
  "xls",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "txt",
]);

export function parseOrgAttachments(metadata: Record<string, unknown> | null | undefined): OrgAttachment[] {
  const raw = metadata?.attachments;
  if (!Array.isArray(raw)) return [];
  const out: OrgAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const createdAt = typeof row.createdAt === "string" ? row.createdAt : "";
    if (!id || !createdAt) continue;
    if (row.kind === "link") {
      const url = typeof row.url === "string" ? row.url.trim() : "";
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!url || !/^https?:\/\//i.test(url)) continue;
      out.push({ id, kind: "link", url, label: label || url, createdAt });
      continue;
    }
    if (row.kind === "file") {
      const fileName = typeof row.fileName === "string" ? row.fileName.trim() : "";
      const contentType = typeof row.contentType === "string" ? row.contentType : "application/octet-stream";
      const storagePath = typeof row.storagePath === "string" ? row.storagePath.trim() : "";
      const sizeBytes = Number(row.sizeBytes) || 0;
      if (!fileName || !storagePath) continue;
      out.push({ id, kind: "file", fileName, contentType, sizeBytes, storagePath, createdAt });
    }
  }
  return out;
}

export function withOrgAttachments(
  metadata: Record<string, unknown> | null | undefined,
  attachments: OrgAttachment[]
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    attachments,
    attachmentsUpdatedAt: new Date().toISOString(),
  };
}

export function attachmentExt(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return (m?.[1] ?? "").toLowerCase();
}

export function isAllowedOrgAttachmentFile(fileName: string, contentType: string): boolean {
  const ext = attachmentExt(fileName);
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;
  return ALLOWED_FILE_TYPES.has(contentType);
}

export function safeAttachmentFileName(name: string): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "-").slice(0, 120);
  return base || "attachment";
}

export function orgAttachmentStoragePath(orgId: string, attachmentId: string, fileName: string): string {
  return `sales-org-attachments/${orgId}/${attachmentId}-${safeAttachmentFileName(fileName)}`;
}

export function newAttachmentId(): string {
  return crypto.randomUUID();
}

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function attachmentLabel(item: OrgAttachment): string {
  if (item.kind === "link") return item.label || item.url;
  return item.fileName;
}

export function formatAttachmentSize(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
