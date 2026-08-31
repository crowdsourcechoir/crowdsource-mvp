"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Organization } from "@/lib/sales/types";
import { readApiJson } from "@/lib/sales/http-error";

type OrgSearchBarProps = {
  selected: Organization | null;
  onSelect: (org: Organization | null) => void;
};

export default function OrgSearchBar({ selected, onSelect }: OrgSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Organization[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setBusy(true);
      void fetch(`/api/sales/organizations?search=${encodeURIComponent(q)}&limit=8`, { cache: "no-store" })
        .then((res) => readApiJson(res))
        .then((data) => {
          const body = data as { organizations?: Organization[] };
          setResults(body.organizations ?? []);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selected) onSelect(null);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search organizations…"
        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-gray-500 focus:outline-none"
      />
      {busy ? <p className="absolute right-3 top-3 text-xs text-gray-600">…</p> : null}
      {selected ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
          <span className="rounded-full border border-sky-800 bg-sky-950/40 px-2.5 py-0.5 text-sky-200">
            {selected.name}
          </span>
          <button type="button" className="text-xs text-gray-500 underline" onClick={() => onSelect(null)}>
            Clear
          </button>
          <Link href={`/admin/sales/organizations/${selected.id}`} className="text-xs text-gray-500 underline">
            Open
          </Link>
        </div>
      ) : null}
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-800 bg-gray-950 py-1 shadow-xl">
          {results.map((org) => (
            <li key={org.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(org);
                  setQuery(org.name);
                  setOpen(false);
                }}
                className="flex w-full flex-col px-4 py-2 text-left hover:bg-gray-900"
              >
                <span className="text-sm text-white">{org.name}</span>
                <span className="text-xs text-gray-500">
                  {[org.locationCity, org.locationRegion].filter(Boolean).join(", ") || org.domain || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
