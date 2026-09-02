"use client";

import { useEffect, useState } from "react";
import { SALES_INITIATIVES, type SalesInitiativeKey } from "@/lib/sales/initiatives";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import SalesSearchBox from "@/components/sales/SalesSearchBox";

const INITIATIVE_KEYS = Object.keys(SALES_INITIATIVES) as SalesInitiativeKey[];

export function AddOrgPlusButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add organization"
      title="Add organization"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-900 hover:text-white ${className}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M10 3.5a.75.75 0 0 1 .75.75V9.25h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5V4.25A.75.75 0 0 1 10 3.5Z" />
      </svg>
    </button>
  );
}

export default function AddOrganizationForm({
  onQueued,
  open,
  onClose,
}: {
  onQueued?: (queueItemId: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactFullName, setContactFullName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactRoleTitle, setContactRoleTitle] = useState("");
  const [salesInitiative, setSalesInitiative] = useState<SalesInitiativeKey | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMessage(null);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/sales/queue/add-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          websiteUrl: websiteUrl.trim() || null,
          salesInitiative: salesInitiative || null,
          contactFullName: contactFullName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactRoleTitle: contactRoleTitle.trim() || null,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not add organization"));
      const body = data as { queued?: boolean; queueItemId?: string | null; message?: string };
      setMessage(body.message ?? "Saved.");
      if (body.queued && body.queueItemId) {
        setName("");
        setWebsiteUrl("");
        setContactFullName("");
        setContactEmail("");
        setContactRoleTitle("");
        onQueued?.(body.queueItemId);
        onClose();
      }
    } catch (err) {
      setError(publicErrorMessage(err, "Could not add organization"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-org-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-950 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="add-org-title" className="text-lg font-semibold text-white">
              Add organization
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Name + a contact (email optional — Hunter will look it up from the website).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!busy) onClose();
            }}
            className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-900 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="Organization name"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Website (for Hunter)"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <input
            value={contactFullName}
            onChange={(e) => setContactFullName(e.target.value)}
            placeholder="Contact first and last name"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Email (optional)"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <input
            value={contactRoleTitle}
            onChange={(e) => setContactRoleTitle(e.target.value)}
            placeholder="Role / title (optional)"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <select
            value={salesInitiative}
            onChange={(e) => setSalesInitiative((e.target.value || "") as SalesInitiativeKey | "")}
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Category (optional)</option>
            {INITIATIVE_KEYS.map((key) => (
              <option key={key} value={key}>
                {SALES_INITIATIVES[key].label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add to queue"}
            </button>
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-400">{error}</p>}
          {message && <p className="sm:col-span-2 text-sm text-emerald-400">{message}</p>}
        </form>
      </div>
    </div>
  );
}

export function AddOrganizationLauncher({ onQueued }: { onQueued?: (queueItemId: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <SalesSearchBox />
      <AddOrgPlusButton onClick={() => setOpen(true)} />
      <AddOrganizationForm open={open} onClose={() => setOpen(false)} onQueued={onQueued} />
    </div>
  );
}
