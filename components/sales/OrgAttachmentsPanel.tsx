"use client";

import { useEffect, useRef, useState } from "react";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import {
  attachmentLabel,
  formatAttachmentSize,
  ORG_ATTACHMENT_MAX_BYTES,
  parseOrgAttachments,
  type OrgAttachment,
} from "@/lib/sales/org-attachments";
import type { Organization } from "@/lib/sales/types";

export default function OrgAttachmentsPanel({
  organization,
  onOrganizationSaved,
}: {
  organization: Organization;
  onOrganizationSaved?: (organization: Organization) => void;
}) {
  const [items, setItems] = useState<OrgAttachment[]>(() =>
    parseOrgAttachments(organization.importMetadata)
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(parseOrgAttachments(organization.importMetadata));
    setError(null);
  }, [organization.id, organization.updatedAt, organization.importMetadata]);

  async function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/organizations/${organization.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "link", url, label: linkLabel.trim() || undefined }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not add link"));
      const body = data as { attachments?: OrgAttachment[]; organization?: Organization };
      setItems(Array.isArray(body.attachments) ? body.attachments : items);
      if (body.organization) onOrganizationSaved?.(body.organization);
      setLinkUrl("");
      setLinkLabel("");
    } catch (err) {
      setError(publicErrorMessage(err, "Could not add link"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const prepared = await fetch(`/api/sales/organizations/${organization.id}/attachments/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
      const slot = await readApiJson(prepared);
      if (!prepared.ok) throw new Error(apiErrorFromBody(slot, "Could not start upload"));
      const upload = (slot as {
        upload: {
          attachmentId: string;
          signedUrl: string;
          path: string;
          contentType: string;
          fileName: string;
        };
      }).upload;

      const put = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": upload.contentType, "x-upsert": "true" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");

      const confirmed = await fetch(`/api/sales/organizations/${organization.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "file",
          attachmentId: upload.attachmentId,
          path: upload.path,
          fileName: upload.fileName,
          contentType: upload.contentType,
          sizeBytes: file.size,
        }),
      });
      const data = await readApiJson(confirmed);
      if (!confirmed.ok) throw new Error(apiErrorFromBody(data, "Could not save file"));
      const body = data as { attachments?: OrgAttachment[]; organization?: Organization };
      setItems(Array.isArray(body.attachments) ? body.attachments : items);
      if (body.organization) onOrganizationSaved?.(body.organization);
    } catch (err) {
      setError(publicErrorMessage(err, "Could not upload file"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAttachment(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/organizations/${organization.id}/attachments/${id}`, {
        method: "DELETE",
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not remove attachment"));
      const body = data as { attachments?: OrgAttachment[]; organization?: Organization };
      setItems(Array.isArray(body.attachments) ? body.attachments : items.filter((a) => a.id !== id));
      if (body.organization) onOrganizationSaved?.(body.organization);
    } catch (err) {
      setError(publicErrorMessage(err, "Could not remove attachment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black p-3">
      <p className="csc-eyebrow">Attachments</p>
      <p className="mt-1 text-xs text-gray-500">
        Google Docs / Drive links, PDFs, Keynote, PowerPoint — kept on this organization.
      </p>

      {items.length > 0 ? (
        <ul className="csc-list mt-3">
          {items.map((item) => (
            <li key={item.id} className="csc-list-row flex items-center justify-between gap-3 py-2">
              <div className="min-w-0 flex-1">
                {item.kind === "link" ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="csc-link block truncate text-sm"
                  >
                    {attachmentLabel(item)}
                  </a>
                ) : (
                  <a
                    href={`/api/sales/organizations/${organization.id}/attachments/${item.id}/download?redirect=1`}
                    className="csc-link block truncate text-sm"
                  >
                    {attachmentLabel(item)}
                  </a>
                )}
                <p className="mt-0.5 truncate text-[11px] text-gray-500">
                  {item.kind === "link"
                    ? "Link"
                    : `File${item.sizeBytes ? ` · ${formatAttachmentSize(item.sizeBytes)}` : ""}`}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeAttachment(item.id)}
                className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-300 hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-gray-500">No attachments yet.</p>
      )}

      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <label className="block text-xs text-gray-500">
          Link (Google Doc, Drive, Notion…)
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
            className="mt-1 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
          />
        </label>
        <label className="block text-xs text-gray-500">
          Label (optional)
          <input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Partnership brief"
            className="mt-1 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !linkUrl.trim()}
            onClick={() => void addLink()}
            className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-200 hover:border-[var(--csc-accent)] disabled:opacity-50"
          >
            {busy ? "Working…" : "Add link"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-[var(--csc-accent)]/50 bg-[var(--csc-accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--csc-accent)] hover:bg-[var(--csc-accent)]/20 disabled:opacity-50"
          >
            Upload file
          </button>
          <span className="text-[11px] text-gray-600">
            Max {Math.round(ORG_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB
          </span>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.key,.keynote,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.txt,application/pdf,application/vnd.apple.keynote"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
