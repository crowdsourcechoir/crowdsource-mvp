"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllEvents } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import { isEventUpcoming } from "@/lib/formatDate";
import CompositionBriefView from "@/app/admin/composition/brief/CompositionBriefView";

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

export default function ComposerPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefEventId, setBriefEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllEvents()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...(Array.isArray(list) ? list : [])].sort((a, b) => {
          const au = isEventUpcoming(a.date) ? 0 : 1;
          const bu = isEventUpcoming(b.date) ? 0 : 1;
          if (au !== bu) return au - bu;
          return (b.date || "").localeCompare(a.date || "");
        });
        setEvents(sorted);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setEvents([]);
        setError(err instanceof Error ? err.message : "Could not load blooms.");
      })
      .finally(() => {
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

  const briefEvent = events.find((e) => e.id === briefEventId) ?? null;

  return (
    <div className="w-full space-y-8 text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Musical Formation
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Composer</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Where living inputs become musical compositions. Pick a Bloom to open its pads, composition canvas, or
          creative brief — with the room, not instead of it.
        </p>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Blooms to compose</h2>
            <p className="mt-1 text-sm text-gray-400">
              Open pads, canvas, or brief for each event. Upcoming blooms first.
            </p>
          </div>
          <Link href="/admin/events" className="text-sm font-medium text-[#CFFF81] hover:underline">
            All Blooms →
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading blooms…</p>
        ) : error ? (
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-transparent px-5 py-8 text-sm text-gray-400">
            No blooms yet.{" "}
            <Link href="/admin/events/new" className="text-[#CFFF81] hover:underline">
              Create one
            </Link>{" "}
            to start composing.
          </div>
        ) : (
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {events.map((event) => {
              const padsHref = `/admin/songgarden/${encodeURIComponent(event.slug || event.id)}`;
              return (
              <li
                key={event.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(padsHref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(padsHref);
                  }
                }}
                className="flex cursor-pointer flex-col gap-3 bg-transparent px-4 py-4 transition-[outline-color] hover:outline hover:outline-1 hover:outline-[#CFFF81] hover:-outline-offset-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {event.title || "Untitled bloom"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {event.date || "No date"}
                    {event.venue ? ` · ${event.venue}` : ""}
                    {event.slug ? ` · ${event.slug}` : ""}
                  </p>
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Link
                    href={padsHref}
                    className="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[#CFFF81] hover:text-white"
                  >
                    Pads / canvas
                  </Link>
                  <button
                    type="button"
                    onClick={() => setBriefEventId(event.id)}
                    className="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[#CFFF81] hover:text-white"
                  >
                    Brief
                  </button>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="rounded-lg border border-[#CFFF81]/40 bg-transparent px-3 py-1.5 text-xs font-medium text-[#CFFF81] transition-colors hover:border-[#CFFF81] hover:bg-[#CFFF81]/10"
                  >
                    Bloom
                  </Link>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-transparent p-5">
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
              className="rounded-full border border-white/15 bg-transparent px-3 py-1.5 text-sm text-gray-200"
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
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl shadow-black/50"
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
