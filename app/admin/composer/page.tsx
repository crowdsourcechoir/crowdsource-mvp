"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAllEvents } from "@/data/eventsClient";
import { compositionBriefAdminUrl } from "@/data/compositionClient";
import type { Event } from "@/data/mockEvents";
import { isEventUpcoming } from "@/lib/formatDate";

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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="w-full space-y-8 text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Musical Formation
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Composer</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Where living inputs become musical compositions. Pick a Bloom to open its pads, composition
          canvas, or creative brief — with the room, not instead of it.
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
          <Link
            href="/admin/events"
            className="text-sm font-medium text-[#CFFF81] hover:underline"
          >
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
          <div className="rounded-xl border border-dashed border-gray-700 bg-[#121214] px-5 py-8 text-sm text-gray-400">
            No blooms yet.{" "}
            <Link href="/admin/events/new" className="text-[#CFFF81] hover:underline">
              Create one
            </Link>{" "}
            to start composing.
          </div>
        ) : (
          <ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-[#121214]">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="block truncate text-base font-semibold text-white hover:text-[#CFFF81]"
                  >
                    {event.title || "Untitled bloom"}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {event.date || "No date"}
                    {event.venue ? ` · ${event.venue}` : ""}
                    {event.slug ? ` · ${event.slug}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/songgarden/${event.id}`}
                    className="rounded-lg border border-gray-700 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-[#CFFF81]/50 hover:text-white"
                  >
                    Pads / canvas
                  </Link>
                  <Link
                    href={compositionBriefAdminUrl({ eventId: event.id })}
                    className="rounded-lg border border-gray-700 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-[#CFFF81]/50 hover:text-white"
                  >
                    Brief
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="rounded-lg border border-[#CFFF81]/40 bg-[#CFFF81]/10 px-3 py-1.5 text-xs font-medium text-[#CFFF81] hover:bg-[#CFFF81]/20"
                  >
                    Bloom
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-800 bg-[#121214] p-5">
        <h2 className="text-lg font-semibold text-white">First-class contribution media</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          Contributions are not only audio or text. Photos, selfies, submitted videos, and short crowd
          clips belong in the same living archive so they can become show visuals, gameday moments,
          sponsor activations, and post-event memories.
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
    </div>
  );
}
