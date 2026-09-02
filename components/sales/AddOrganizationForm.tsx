"use client";

import { useState } from "react";
import { SALES_INITIATIVES, type SalesInitiativeKey } from "@/lib/sales/initiatives";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

const INITIATIVE_KEYS = Object.keys(SALES_INITIATIVES) as SalesInitiativeKey[];

export default function AddOrganizationForm({
  onQueued,
  compact = false,
}: {
  onQueued?: (queueItemId: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactFullName, setContactFullName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactRoleTitle, setContactRoleTitle] = useState("");
  const [salesInitiative, setSalesInitiative] = useState<SalesInitiativeKey | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      }
    } catch (err) {
      setError(publicErrorMessage(err, "Could not add organization"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Add organization</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Name + a contact (email optional — Hunter will look it up from the website).
          </p>
        </div>
        {compact && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-200 hover:bg-gray-800"
          >
            {open ? "Hide" : "Add org"}
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
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
          <div className="sm:col-span-2">
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
      )}
    </div>
  );
}
