"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import { SEARCH_MIN_CHARS, type SalesSearchHit } from "@/lib/sales/search/query";
import { StatusPill } from "@/components/settings/ui";

export default function SalesSearchBox({
  onPick,
}: {
  onPick?: (hit: SalesSearchHit) => void;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SalesSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setHits([]);
      setError(null);
      setBusy(false);
      return;
    }
    const ac = new AbortController();
    setBusy(true);
    const handle = window.setTimeout(() => {
      fetch(`/api/sales/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: ac.signal })
        .then(async (res) => {
          const data = await readApiJson(res);
          if (!res.ok) throw new Error(apiErrorFromBody(data, "Search failed"));
          const body = data as { hits?: SalesSearchHit[] };
          setHits(body.hits ?? []);
          setError(null);
          setOpen(true);
          setActive(0);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setHits([]);
          setError(publicErrorMessage(err, "Search failed"));
          setOpen(true);
        })
        .finally(() => {
          if (!ac.signal.aborted) setBusy(false);
        });
    }, 280);
    return () => {
      window.clearTimeout(handle);
      ac.abort();
    };
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(hit: SalesSearchHit) {
    setOpen(false);
    if (onPick) {
      onPick(hit);
      return;
    }
    router.push(`/admin/sales/organizations/${hit.organizationId}`);
  }

  const showMenu = open && query.trim().length >= SEARCH_MIN_CHARS;

  return (
    <div ref={rootRef} className="relative w-40 shrink-0 sm:w-56">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim().length >= SEARCH_MIN_CHARS) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(hits.length - 1, i + 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
            return;
          }
          if (e.key === "Enter" && showMenu && hits[active]) {
            e.preventDefault();
            pick(hits[active]);
          }
        }}
        placeholder="Search…"
        aria-label="Search organizations, contacts, titles"
        className="h-9 w-full rounded-full border border-[var(--csc-row-divider)] bg-transparent px-3 text-sm text-white placeholder:text-gray-500 focus:border-[var(--csc-accent)] focus:outline-none"
      />
      {showMenu && (
        <div
          role="listbox"
          className="absolute right-0 z-40 mt-1.5 max-h-80 w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[var(--csc-row-divider)] bg-black"
        >
          {busy && hits.length === 0 && !error ? (
            <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>
          ) : error ? (
            <p className="px-4 py-3 text-sm text-red-300">{error}</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No matches.</p>
          ) : (
            <div className="divide-y divide-[var(--csc-row-divider)]">
              {hits.map((hit, i) => {
                const selected = i === active;
                return (
                  <button
                    key={hit.organizationId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(hit)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left outline outline-[length:var(--csc-outline-width)] -outline-offset-1 transition-[outline-color] ${
                      selected
                        ? "outline-[var(--csc-accent)]"
                        : "outline-transparent hover:outline-[var(--csc-accent)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{hit.organizationName}</span>
                      <span className="mt-0.5 block truncate text-xs text-gray-400">{hit.matchLabel}</span>
                    </span>
                    {hit.queueItemId ? (
                      <StatusPill tone="ok">Queue</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Org</StatusPill>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
