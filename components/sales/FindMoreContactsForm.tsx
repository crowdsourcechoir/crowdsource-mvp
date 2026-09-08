"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { QueueItemDetail } from "@/lib/sales/types";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

const SUGGESTIONS = ["events team", "director of development", "marketing", "programming", "executive"];

export default function FindMoreContactsForm({
  itemId,
  orgName,
  domainHint,
  open,
  onOpenChange,
  onFound,
}: {
  itemId: string;
  orgName: string;
  domainHint?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFound: (detail: QueueItemDetail | null, message: string) => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInfo(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/sales/queue/${itemId}/find-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not find contacts"));
      const body = data as {
        detail?: QueueItemDetail | null;
        message?: string;
        added?: unknown[];
      };
      const message = body.message ?? "Hunter search finished.";
      onFound(body.detail ?? null, message);
      if ((body.added?.length ?? 0) > 0) {
        onOpenChange(false);
        setQuery("");
        setInfo(null);
      } else {
        setInfo(message);
      }
    } catch (err) {
      setError(publicErrorMessage(err, "Could not find contacts"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="rounded-md border border-dashed border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-200"
      >
        Find more contacts
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => {
            if (!busy) onOpenChange(false);
          }}
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-xl border border-white/15 bg-black p-5 shadow-2xl shadow-black/70"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-semibold text-white">
              Find more contacts
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Hunter will search {orgName}
              {domainHint ? ` (${domainHint})` : ""} for people matching what you type, then add them to this
              contacts grid.
            </p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500" htmlFor={`${titleId}-q`}>
              Who should we look for?
            </label>
            <input
              id={`${titleId}-q`}
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              placeholder="e.g. events team"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    query === s
                      ? "border-[var(--csc-accent)]/50 bg-[var(--csc-accent)]/15 text-[var(--csc-accent)]"
                      : "border-white/15 text-gray-300 hover:border-[var(--csc-accent)]/40 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              About 1 Hunter credit per 10 people returned. Misses on a filtered search are not billed.
            </p>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            {!error && info && <p className="mt-2 text-xs text-[var(--csc-accent)]">{info}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !query.trim()}
                className="rounded-lg bg-[var(--csc-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Searching Hunter…" : "Search Hunter"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
