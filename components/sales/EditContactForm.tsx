"use client";

import { useState, type FormEvent } from "react";
import type { Contact, QueueItemDetail } from "@/lib/sales/types";
import { normalizeEmail } from "@/lib/sales/dedupe";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

export default function EditContactForm({
  contact,
  queueItemId,
  onSaved,
  onCancel,
}: {
  contact: Contact;
  queueItemId: string;
  onSaved: (detail: QueueItemDetail | null, message: string) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(contact.fullName ?? "");
  const [email, setEmail] = useState(normalizeEmail(contact.email) ?? contact.email ?? "");
  const [roleTitle, setRoleTitle] = useState(contact.roleTitle ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() && !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || null,
          roleTitle: roleTitle.trim() || null,
          queueItemId,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not update contact"));
      const body = data as { detail?: QueueItemDetail | null; message?: string };
      onSaved(body.detail ?? null, body.message ?? "Contact updated.");
    } catch (err) {
      setError(publicErrorMessage(err, "Could not update contact"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-white/15 bg-black p-3">
      <p className="text-xs text-gray-500">Fix name, email, or role. Trailing punctuation on emails is stripped on save.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Name"
          className="rounded-lg border border-white/15 bg-black px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
          autoFocus
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
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
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-white/15 px-3 py-1 text-xs text-gray-300 hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
