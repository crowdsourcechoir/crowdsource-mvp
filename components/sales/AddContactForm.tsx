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
    if (!fullName.trim() && !email.trim()) return;
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
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-[var(--csc-accent)]/40 bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--csc-accent)] transition-colors hover:bg-[var(--csc-accent)]/10"
        >
          + Add contact
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-lg border border-white/15 bg-black p-3">
          <p className="text-xs text-gray-500">Named person, or a general inbox like info@ / events@. Leave email blank to let Hunter look up a person from this org’s website.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Name, or blank for info@ / events@"
              className="rounded-lg border border-white/15 bg-black px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (info@ / events@ ok)"
              className="rounded-lg border border-white/15 bg-black px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
            />
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Role (optional)"
              className="rounded-lg border border-white/15 bg-black px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
            />
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={busy || (!fullName.trim() && !email.trim())}
              className="rounded-lg bg-[var(--csc-accent)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add contact"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-lg border border-white/15 px-3 py-1 text-xs text-gray-300 hover:border-[var(--csc-accent)] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
