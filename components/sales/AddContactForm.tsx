"use client";

import { useState } from "react";
import type { QueueItemDetail } from "@/lib/sales/types";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

export default function AddContactForm({
  itemId,
  onAdded,
}: {
  itemId: string;
  onAdded: (detail: QueueItemDetail | null, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/queue/${itemId}/add-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || null,
          roleTitle: roleTitle.trim() || null,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not add contact"));
      const body = data as { detail?: QueueItemDetail | null; message?: string };
      setFullName("");
      setEmail("");
      setRoleTitle("");
      setOpen(false);
      onAdded(body.detail ?? null, body.message ?? "Contact added.");
    } catch (err) {
      setError(publicErrorMessage(err, "Could not add contact"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-dashed border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-500 hover:text-white"
        >
          + Add contact
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
          <p className="text-xs text-gray-500">Leave email blank to let Hunter look it up from this org’s website.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="First and last name"
              className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white placeholder:text-gray-500"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white placeholder:text-gray-500"
            />
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Role (optional)"
              className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white placeholder:text-gray-500"
            />
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={busy || !fullName.trim()}
              className="rounded-md bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add contact"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
