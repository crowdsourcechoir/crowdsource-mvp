"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SettingsButton } from "@/components/settings/ui";
import { SEARCH_MIN_CHARS, type SalesSearchHit } from "@/lib/sales/search/query";

export default function PitchOrgField({
  pitchId,
  organizationId,
  organizationName,
  onAssigned,
}: {
  pitchId: string;
  organizationId: string | null;
  organizationName: string | null;
  onAssigned: (next: { organizationId: string | null; organizationName: string | null }) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SalesSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setHits([]);
      setOpen(false);
      return;
    }
    const ac = new AbortController();
    const handle = window.setTimeout(() => {
      fetch(`/api/sales/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: ac.signal })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Search failed");
          setHits((data.hits ?? []) as SalesSearchHit[]);
          setOpen(true);
          setStatus(null);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setHits([]);
          setOpen(true);
          setStatus(err instanceof Error ? err.message : "Search failed");
        });
    }, 280);
    return () => {
      window.clearTimeout(handle);
      ac.abort();
    };
  }, [query]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function assign(nextId: string | null, nextName: string | null) {
    setBusy(true);
    setStatus(null);
    setOpen(false);
    try {
      const res = await fetch(`/api/pitches/${pitchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: nextId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not connect the organization");
      const savedId = (data.pitch?.organizationId ?? null) as string | null;
      const savedName = (data.pitch?.organizationName ?? nextName) as string | null;
      onAssigned({ organizationId: savedId, organizationName: savedId ? savedName : null });
      setQuery("");
      setStatus(savedId ? "Connected." : "Removed.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not connect the organization");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative border-b border-[var(--csc-row-divider)] py-3">
      <p className="csc-eyebrow">Organization</p>
      {organizationId ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link href={`/admin/sales/organizations/${organizationId}`} className="csc-link text-sm">
            {organizationName || "Connected organization"}
          </Link>
          <SettingsButton disabled={busy} onClick={() => void assign(null, null)}>
            Remove
          </SettingsButton>
        </div>
      ) : (
        <p className="mt-1 text-sm text-white/50">Not connected to a sales organization.</p>
      )}
      <label className="mt-2 block">
        <span className="sr-only">Search organizations</span>
        <input
          value={query}
          disabled={busy}
          placeholder="Search for an organization"
          aria-label="Search organizations"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (hits.length) setOpen(true);
          }}
          className="w-full border border-white/15 bg-black px-3 py-1.5 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none disabled:opacity-50"
        />
      </label>
      {status ? <p className="mt-2 text-sm text-white/70">{status}</p> : null}
      {open && query.trim().length >= SEARCH_MIN_CHARS ? (
        <div className="csc-list absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-[var(--csc-row-divider)] bg-black">
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-sm text-white/50">{status ?? "No matches."}</p>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.organizationId}
                type="button"
                className="csc-list-row w-full text-left"
                onClick={() => void assign(hit.organizationId, hit.organizationName)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{hit.organizationName}</span>
                  <span className="block truncate text-xs text-white/50">{hit.matchLabel}</span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
