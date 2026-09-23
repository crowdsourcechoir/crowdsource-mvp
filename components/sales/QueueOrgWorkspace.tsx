"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FollowUpControls from "@/components/sales/FollowUpControls";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import type { Organization, Opportunity } from "@/lib/sales/types";

type NoteRow = { id: string; text: string; occurredAt: string };

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Inline org editor + notes + follow-up, designed for the sales queue detail pane.
 * Uses design-system tokens (black shell, accent borders) — no gray card fork.
 */
export default function QueueOrgWorkspace({
  organization,
  opportunity,
  onOrganizationSaved,
  onFollowUpSaved,
}: {
  organization: Organization;
  opportunity: Opportunity;
  onOrganizationSaved?: (organization: Organization) => void;
  onFollowUpSaved?: (nextFollowUpAt: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(organization.name);
  const [websiteUrl, setWebsiteUrl] = useState(organization.websiteUrl ?? "");
  const [locationCity, setLocationCity] = useState(organization.locationCity ?? "");
  const [locationRegion, setLocationRegion] = useState(organization.locationRegion ?? "");
  const [orgNotes, setOrgNotes] = useState(
    typeof organization.importMetadata?.operatorNotes === "string"
      ? organization.importMetadata.operatorNotes
      : ""
  );
  const [isExistingClient, setIsExistingClient] = useState(organization.isExistingClient);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    setName(organization.name);
    setWebsiteUrl(organization.websiteUrl ?? "");
    setLocationCity(organization.locationCity ?? "");
    setLocationRegion(organization.locationRegion ?? "");
    setOrgNotes(
      typeof organization.importMetadata?.operatorNotes === "string"
        ? organization.importMetadata.operatorNotes
        : ""
    );
    setIsExistingClient(organization.isExistingClient);
    setEditing(false);
    setError(null);
    setSavedFlash(null);
  }, [organization.id, organization.updatedAt]);

  useEffect(() => {
    let cancelled = false;
    async function loadNotes() {
      try {
        const res = await fetch(`/api/sales/opportunities/${opportunity.id}/notes`, { cache: "no-store" });
        const data = await readApiJson(res);
        if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not load notes"));
        if (!cancelled) {
          setNotes(Array.isArray((data as { notes?: NoteRow[] }).notes) ? (data as { notes: NoteRow[] }).notes : []);
          setNotesError(null);
        }
      } catch (err) {
        if (!cancelled) setNotesError(publicErrorMessage(err, "Could not load notes"));
      }
    }
    void loadNotes();
    return () => {
      cancelled = true;
    };
  }, [opportunity.id]);

  async function saveOrg() {
    setBusy(true);
    setError(null);
    setSavedFlash(null);
    try {
      const res = await fetch(`/api/sales/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          websiteUrl: websiteUrl.trim() || null,
          locationCity: locationCity.trim() || null,
          locationRegion: locationRegion.trim() || null,
          isExistingClient,
          operatorNotes: orgNotes.trim() || null,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not save organization"));
      const next = (data as { organization: Organization }).organization;
      onOrganizationSaved?.(next);
      setEditing(false);
      setSavedFlash("Saved");
    } catch (err) {
      setError(publicErrorMessage(err, "Could not save organization"));
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    const text = noteDraft.trim();
    if (!text) return;
    setNotesBusy(true);
    setNotesError(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunity.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not save note"));
      const note = (data as { note: NoteRow }).note;
      setNotes((prev) => [note, ...prev]);
      setNoteDraft("");
    } catch (err) {
      setNotesError(publicErrorMessage(err, "Could not save note"));
    } finally {
      setNotesBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border border-white/10 bg-black p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="csc-eyebrow">Organization</p>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/sales/organizations/${organization.id}`}
              className="csc-link text-xs"
            >
              Open org page
            </Link>
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v);
                setError(null);
                setSavedFlash(null);
              }}
              className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
        </div>

        {!editing ? (
          <div className="mt-2 space-y-1 text-sm text-gray-300">
            <p className="font-medium text-white">{organization.name}</p>
            {organization.websiteUrl ? (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="csc-link break-all text-xs"
              >
                {organization.websiteUrl}
              </a>
            ) : (
              <p className="text-xs text-gray-500">No website on file</p>
            )}
            {(organization.locationCity || organization.locationRegion) && (
              <p className="text-xs text-gray-500">
                {[organization.locationCity, organization.locationRegion].filter(Boolean).join(", ")}
              </p>
            )}
            {orgNotes ? <p className="mt-2 whitespace-pre-wrap text-xs text-gray-400">{orgNotes}</p> : null}
            {isExistingClient ? <p className="text-xs text-[var(--csc-accent)]">Existing client</p> : null}
            {savedFlash ? <p className="text-xs text-[var(--csc-accent)]">{savedFlash}</p> : null}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-gray-500">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
              />
            </label>
            <label className="block text-xs text-gray-500">
              Website
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
                className="mt-1 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-gray-500">
                City
                <input
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
                />
              </label>
              <label className="block text-xs text-gray-500">
                Region / state
                <input
                  value={locationRegion}
                  onChange={(e) => setLocationRegion(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
                />
              </label>
            </div>
            <label className="block text-xs text-gray-500">
              Org notes (sticky on the organization)
              <textarea
                value={orgNotes}
                onChange={(e) => setOrgNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={isExistingClient}
                onChange={(e) => setIsExistingClient(e.target.checked)}
                className="accent-[var(--csc-accent)]"
              />
              Existing client
            </label>
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void saveOrg()}
              className="rounded-full border border-[var(--csc-accent)]/50 bg-[var(--csc-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--csc-accent)] hover:bg-[var(--csc-accent)]/20 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save organization"}
            </button>
          </div>
        )}
      </div>

      <FollowUpControls
        opportunityId={opportunity.id}
        nextFollowUpAt={opportunity.nextFollowUpAt}
        onSaved={onFollowUpSaved}
      />

      <div className="rounded-lg border border-white/10 bg-black p-3">
        <p className="csc-eyebrow">Notes</p>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={2}
          placeholder="Quick note on this opportunity…"
          className="mt-2 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={notesBusy || !noteDraft.trim()}
            onClick={() => void addNote()}
            className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-200 hover:border-[var(--csc-accent)] disabled:opacity-50"
          >
            {notesBusy ? "Adding…" : "Add note"}
          </button>
          {notesError ? <p className="text-xs text-red-400">{notesError}</p> : null}
        </div>
        {notes.length > 0 ? (
          <ul className="csc-list mt-3">
            {notes.map((note) => (
              <li key={note.id} className="csc-list-row !block py-2">
                <p className="whitespace-pre-wrap text-sm text-gray-200">{note.text}</p>
                <p className="mt-1 text-[11px] text-gray-500">{formatWhen(note.occurredAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-gray-500">No notes yet.</p>
        )}
      </div>
    </div>
  );
}
