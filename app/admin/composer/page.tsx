"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAllEvents } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import { isEventUpcoming } from "@/lib/formatDate";
import CompositionBriefView from "@/app/admin/composition/brief/CompositionBriefView";
import type { Garden } from "@/lib/song-garden-v2/garden/types";
import AdminClickableRow, { ADMIN_ROW_ACTION } from "@/components/AdminClickableRow";

const contributionTypes = [
  "Voice",
  "Words",
  "Sounds",
  "Photos",
  "Selfies",
  "Videos",
  "Chants",
  "Ambient moments",
];

type ComposeItem =
  | { kind: "garden"; id: string; garden: Garden }
  | { kind: "bloom"; id: string; event: Event };

function bloomCanvasHref(eventId: string) {
  return `/admin/songgarden/${eventId}`;
}

function gardenCanvasHref(gardenId: string) {
  return `/admin/gardens/${gardenId}/canvas`;
}

export default function ComposerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefEventId, setBriefEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getAllEvents(),
      fetch("/api/gardens", { cache: "no-store" }).then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { gardens?: Garden[]; error?: string };
        if (!res.ok) throw new Error(body.error || "Could not load gardens.");
        return body.gardens ?? [];
      }),
    ]).then(([eventsResult, gardensResult]) => {
      if (cancelled) return;
      const nextEvents = eventsResult.status === "fulfilled" ? (Array.isArray(eventsResult.value) ? eventsResult.value : []) : [];
      const nextGardens = gardensResult.status === "fulfilled" ? gardensResult.value : [];
      setEvents(nextEvents);
      setGardens(nextGardens);
      const parts: string[] = [];
      if (eventsResult.status === "rejected") {
        parts.push(eventsResult.reason instanceof Error ? eventsResult.reason.message : "Could not load blooms.");
      }
      if (gardensResult.status === "rejected") {
        parts.push(gardensResult.reason instanceof Error ? gardensResult.reason.message : "Could not load gardens.");
      }
      setError(parts.length && nextEvents.length === 0 && nextGardens.length === 0 ? parts.join(" ") : null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!briefEventId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setBriefEventId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefEventId]);

  const items = useMemo<ComposeItem[]>(() => {
    const gardenItems: ComposeItem[] = [...gardens]
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .map((garden) => ({ kind: "garden", id: garden.id, garden }));
    const bloomItems: ComposeItem[] = [...events]
      .sort((a, b) => {
        const au = isEventUpcoming(a.date) ? 0 : 1;
        const bu = isEventUpcoming(b.date) ? 0 : 1;
        if (au !== bu) return au - bu;
        return (b.date || "").localeCompare(a.date || "");
      })
      .map((event) => ({ kind: "bloom", id: event.id, event }));
    return [...gardenItems, ...bloomItems];
  }, [events, gardens]);

  const briefEvent = events.find((e) => e.id === briefEventId) ?? null;

  return (
    <div className="w-full space-y-8 text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Musical Formation
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Composer</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Where living inputs become musical compositions. Pick a Garden or Bloom to open its pads and composition
          canvas — with the room, not instead of it.
        </p>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Gardens and Blooms</h2>
            <p className="mt-1 text-sm text-gray-400">
              One list to compose from. Open a row for pads / canvas. Gardens first, then upcoming blooms.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Link href="/admin/gardens" className="text-[#CFFF81] hover:underline">
              All Gardens →
            </Link>
            <Link href="/admin/events" className="text-[#CFFF81] hover:underline">
              All Blooms →
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading gardens and blooms…</p>
        ) : error ? (
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#121212] px-5 py-8 text-sm text-gray-400">
            Nothing to compose yet.{" "}
            <Link href="/admin/gardens" className="text-[#CFFF81] hover:underline">
              Create a garden
            </Link>{" "}
            or{" "}
            <Link href="/admin/events/new" className="text-[#CFFF81] hover:underline">
              create a bloom
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              if (item.kind === "garden") {
                const { garden } = item;
                const canvasHref = gardenCanvasHref(garden.id);
                return (
                  <li key={`garden-${garden.id}`}>
                    <AdminClickableRow href={canvasHref} ariaLabel={`Open pads and canvas for ${garden.title}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">{garden.title || "Untitled garden"}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            <span className="mr-2 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300">
                              Garden
                            </span>
                            /{garden.slug}
                            {garden.status ? ` · ${garden.status}` : ""}
                          </p>
                        </div>
                        <div className={`${ADMIN_ROW_ACTION} flex flex-wrap gap-2`}>
                          <Link
                            href={canvasHref}
                            className="rounded-lg bg-[#CFFF81] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#bdf25e]"
                          >
                            Pads / canvas
                          </Link>
                          <Link
                            href={`/admin/gardens/${garden.id}`}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/10"
                          >
                            Garden
                          </Link>
                        </div>
                      </div>
                    </AdminClickableRow>
                  </li>
                );
              }

              const { event } = item;
              const canvasHref = bloomCanvasHref(event.id);
              return (
                <li key={`bloom-${event.id}`}>
                  <AdminClickableRow href={canvasHref} ariaLabel={`Open pads and canvas for ${event.title || "bloom"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">{event.title || "Untitled bloom"}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          <span className="mr-2 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300">
                            Bloom
                          </span>
                          {event.date || "No date"}
                          {event.venue ? ` · ${event.venue}` : ""}
                          {event.slug ? ` · ${event.slug}` : ""}
                        </p>
                      </div>
                      <div className={`${ADMIN_ROW_ACTION} flex flex-wrap gap-2`}>
                        <Link
                          href={canvasHref}
                          className="rounded-lg bg-[#CFFF81] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#bdf25e]"
                        >
                          Pads / canvas
                        </Link>
                        <button
                          type="button"
                          onClick={() => setBriefEventId(event.id)}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/10"
                        >
                          Brief
                        </button>
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/10"
                        >
                          Bloom
                        </Link>
                      </div>
                    </div>
                  </AdminClickableRow>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121212] p-5">
        <h2 className="text-lg font-semibold text-white">First-class contribution media</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          Contributions are not only audio or text. Photos, selfies, submitted videos, and short crowd clips belong in
          the same living archive so they can become show visuals, gameday moments, sponsor activations, and
          post-event memories.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {contributionTypes.map((type) => (
            <span
              key={type}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200"
            >
              {type}
            </span>
          ))}
        </div>
      </section>

      {briefEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-black/70"
            onClick={() => setBriefEventId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Composition Brief"
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#121214] shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
                  Musical Formation
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Composition Brief</h2>
                <p className="mt-1 text-sm text-gray-400">
                  {briefEvent?.title || "Organized creative material from audience participation."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBriefEventId(null)}
                className="rounded-lg border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-800"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <Suspense fallback={<p className="text-sm text-gray-500">Loading brief…</p>}>
                <CompositionBriefView key={briefEventId} eventId={briefEventId} embedded />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
