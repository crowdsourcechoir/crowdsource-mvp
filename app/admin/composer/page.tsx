"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { getAllEvents } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
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

const composerAreas = [
  {
    title: "Garden material",
    description: "Open a Garden to tend its map, chapters, memory, and arrangement surface.",
    href: "/admin/gardens",
    cta: "Open Gardens",
  },
  {
    title: "Bloom material",
    description: "Open a Bloom to review contributions, media, song seeds, memory, and live prep.",
    href: "/admin/events",
    cta: "Open Blooms",
  },
  {
    title: "Song Garden audio pads",
    description: "Use the event-specific arrangement surface for audio clips, pads, and pre-show musical material.",
    href: "/admin/events",
    cta: "Choose a Bloom",
  },
];

export default function ComposerPage() {
  const [briefOpen, setBriefOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (!briefOpen) return;
    setLoadingEvents(true);
    getAllEvents()
      .then((list) => {
        setEvents(Array.isArray(list) ? list : []);
        setSelectedEventId((prev) => {
          if (prev) return prev;
          return Array.isArray(list) && list[0]?.id ? String(list[0].id) : "";
        });
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [briefOpen]);

  useEffect(() => {
    if (!briefOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setBriefOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefOpen]);

  return (
    <div className="w-full space-y-8 text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Musical Formation
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Composer</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Where living inputs become musical compositions. Composer gathers voice, words, sounds, images, and video
          from a Garden or Bloom and shapes them into songs, chants, anthems, and show material — with the room, not
          instead of it.
        </p>
      </div>

      <section className="rounded-xl border border-gray-800 bg-[#121214] p-5">
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
              className="rounded-full border border-gray-700 bg-[#18181b] px-3 py-1.5 text-sm text-gray-200"
            >
              {type}
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Composer entry points</h2>
          <p className="mt-1 text-sm text-gray-400">
            Surfaces for gathering material and forming it into musical compositions.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {composerAreas.map((area) => (
            <Link
              key={area.title}
              href={area.href}
              className="rounded-xl border border-gray-800 bg-[#121214] p-5 transition hover:border-[#CFFF81]/50 hover:bg-[#18181b]"
            >
              <h3 className="text-base font-semibold text-white">{area.title}</h3>
              <p className="mt-2 min-h-[3rem] text-sm leading-6 text-gray-400">{area.description}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-[#CFFF81]">
                {area.cta}
                {" ->"}
              </span>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setBriefOpen(true)}
            className="rounded-xl border border-gray-800 bg-[#121214] p-5 text-left transition hover:border-[#CFFF81]/50 hover:bg-[#18181b]"
          >
            <h3 className="text-base font-semibold text-white">Composition brief</h3>
            <p className="mt-2 min-h-[3rem] text-sm leading-6 text-gray-400">
              Turn collected voices, words, sounds, images, and videos into musical direction and song material.
            </p>
            <span className="mt-4 inline-flex text-sm font-semibold text-[#CFFF81]">Open brief -&gt;</span>
          </button>
        </div>
      </section>

      {briefOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-black/70"
            onClick={() => setBriefOpen(false)}
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
                  Organized creative material from audience participation and Signal choices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBriefOpen(false)}
                className="rounded-lg border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="border-b border-gray-800 px-5 py-3">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                Bloom
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  disabled={loadingEvents}
                  className="mt-1.5 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white focus:border-gray-500 focus:outline-none"
                >
                  {loadingEvents ? (
                    <option value="">Loading blooms…</option>
                  ) : events.length === 0 ? (
                    <option value="">No blooms yet</option>
                  ) : (
                    events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selectedEventId ? (
                <Suspense fallback={<p className="text-sm text-gray-500">Loading brief…</p>}>
                  <CompositionBriefView key={selectedEventId} eventId={selectedEventId} embedded />
                </Suspense>
              ) : (
                <p className="text-sm text-gray-500">Choose a Bloom to generate or view its composition brief.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
