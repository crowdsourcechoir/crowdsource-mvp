"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsButton } from "@/components/settings/ui";
import type { ShowDeck } from "@/lib/show-slides/model";

export default function ShowsLibrary() {
  const router = useRouter();
  const [shows, setShows] = useState<ShowDeck[] | null>(null);
  const [name, setName] = useState("");
  const [naming, setNaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shows", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load shows");
        if (!cancelled) {
          setShows(data.shows ?? []);
          if (data.error) setStatus(data.error);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Could not load shows");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  function beginShow() {
    if (naming && name.trim()) {
      void createShow();
      return;
    }
    setNaming(true);
  }

  async function createShow() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/shows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the show");
      router.push(`/admin/shows/${data.show.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create the show");
      setBusy(false);
    }
  }

  return (
    <section className="mb-10 text-white">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white sm:text-xl">Lyric slides</h2>
        <SettingsButton variant="primary" disabled={busy} expanded={naming} onClick={beginShow}>
          {busy ? "Creating" : "New show"}
        </SettingsButton>
      </div>
      {naming ? (
        <form
          className="mt-4 max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            void createShow();
          }}
        >
          <input
            ref={nameRef}
            aria-label="Show name"
            value={name}
            placeholder="Name a show"
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              setNaming(false);
              setName("");
            }}
            className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none disabled:opacity-50"
          />
        </form>
      ) : null}
      {status ? <p className="mt-3 text-sm text-amber-200">{status}</p> : null}

      <div className="csc-list mt-8">
        {shows === null ? (
          <div className="csc-list-row">
            <p className="text-sm text-gray-400">Loading shows</p>
          </div>
        ) : (
          shows.map((show) => (
            <Link key={show.id} href={`/admin/shows/${show.id}`} className="csc-list-row">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{show.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  /show/{show.slug}
                  {show.builtin ? " · Gather Song Garden" : ""}
                  {show.bloomId ? " · bloom assigned" : show.gardenId ? " · garden assigned" : show.match ? " · matches a bloom named Gather" : ""}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.16em] text-[var(--csc-accent)]">Edit</span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
