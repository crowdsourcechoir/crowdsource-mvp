"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsButton, TextField } from "@/components/settings/ui";
import type { ShowDeck } from "@/lib/show-slides/model";

export default function ShowsLibrary() {
  const router = useRouter();
  const [shows, setShows] = useState<ShowDeck[] | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="text-white">
      <p className="csc-eyebrow">Lyric projection</p>
      <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Shows</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-400">
        1920×1080 lyric slides. A click or the space bar reveals the next line, the same way a pitch deck steps
        forward. The background is that bloom&apos;s video loop, with a glass card behind the words so they stay legible.
      </p>

      <div className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <TextField value={name} onChange={setName} placeholder="Name a show" />
        </div>
        <SettingsButton variant="primary" disabled={busy || !name.trim()} onClick={createShow}>
          {busy ? "Creating" : "New show"}
        </SettingsButton>
      </div>
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
                  {show.builtin ? " · Gather conference" : ""}
                  {show.bloomId ? " · bloom assigned" : show.gardenId ? " · garden assigned" : show.match ? " · matches a bloom named Gather" : ""}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.16em] text-[var(--csc-accent)]">Edit</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
