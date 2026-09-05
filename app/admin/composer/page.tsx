"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getAllEvents } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import { isEventUpcoming } from "@/lib/formatDate";
import SonggardenCanvas from "@/components/songgarden/SonggardenCanvas";

type ComposerView = "master" | "browse";
type GardenRow = { id: string; slug: string; title: string };

function pillClass(active: boolean): string {
  return active
    ? "bg-[#CFFF81] text-[#1a1530]"
    : "border border-white/15 text-gray-300 hover:border-[#CFFF81]/50 hover:text-white";
}

function ComposerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: ComposerView = viewParam === "browse" ? "browse" : "master";

  const [events, setEvents] = useState<Event[]>([]);
  const [gardens, setGardens] = useState<GardenRow[]>([]);
  const [browseLoading, setBrowseLoading] = useState(view === "browse");
  const [browseError, setBrowseError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "browse") return;
    let cancelled = false;
    setBrowseLoading(true);
    setBrowseError(null);
    Promise.all([
      getAllEvents(),
      fetch("/api/gardens", { cache: "no-store" }).then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          gardens?: GardenRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Could not load gardens.");
        return body.gardens ?? [];
      }),
    ])
      .then(([eventList, gardenList]) => {
        if (cancelled) return;
        const sorted = [...(Array.isArray(eventList) ? eventList : [])].sort((a, b) => {
          const au = isEventUpcoming(a.date) ? 0 : 1;
          const bu = isEventUpcoming(b.date) ? 0 : 1;
          if (au !== bu) return au - bu;
          return (b.date || "").localeCompare(a.date || "");
        });
        setEvents(sorted);
        setGardens(gardenList);
      })
      .catch((err) => {
        if (cancelled) return;
        setEvents([]);
        setGardens([]);
        setBrowseError(err instanceof Error ? err.message : "Could not load list.");
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const upcoming = useMemo(() => events.filter((e) => isEventUpcoming(e.date)), [events]);
  const past = useMemo(() => events.filter((e) => !isEventUpcoming(e.date)), [events]);

  function setView(next: ComposerView) {
    const url = next === "browse" ? "/admin/composer?view=browse" : "/admin/composer";
    router.replace(url);
  }

  return (
    <div className="w-full space-y-6 text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
            Musical Formation
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Composer</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("master")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pillClass(view === "master")}`}
          >
            Master — all sounds
          </button>
          <button
            type="button"
            onClick={() => setView("browse")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pillClass(view === "browse")}`}
          >
            Blooms & Gardens
          </button>
        </div>
      </div>

      {view === "master" ? (
        <SonggardenCanvas initialScope="master" />
      ) : (
        <div className="space-y-8">
          {browseLoading ? <p className="text-sm text-gray-500">Loading…</p> : null}
          {browseError ? (
            <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-4 text-sm text-rose-200">
              {browseError}
            </div>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Song Gardens</h2>
              <Link
                href="/admin/gardens"
                className="text-sm font-medium text-[#CFFF81] hover:underline"
              >
                All Gardens →
              </Link>
            </div>
            {!browseLoading && gardens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 px-5 py-6 text-sm text-gray-400">
                No Song Gardens yet.{" "}
                <Link href="/admin/gardens/new" className="text-[#CFFF81] hover:underline">
                  Create one
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-white/10 border-y border-white/10">
                {gardens.map((garden) => (
                  <li key={garden.id}>
                    <Link
                      href={`/admin/gardens/${encodeURIComponent(garden.id)}`}
                      className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{garden.title}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{garden.slug}</p>
                      </div>
                      <span className="shrink-0 text-xs text-[#CFFF81]">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Blooms</h2>
              <Link
                href="/admin/events"
                className="text-sm font-medium text-[#CFFF81] hover:underline"
              >
                All Blooms →
              </Link>
            </div>
            {!browseLoading && events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 px-5 py-6 text-sm text-gray-400">
                No blooms yet.{" "}
                <Link href="/admin/events/new" className="text-[#CFFF81] hover:underline">
                  Create one
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-white/10 border-y border-white/10">
                {[...upcoming, ...past].map((event) => {
                  const padsHref = `/admin/songgarden/${encodeURIComponent(event.slug || event.id)}`;
                  return (
                    <li
                      key={event.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(padsHref)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-base font-semibold text-white">
                          {event.title || "Untitled bloom"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {event.date || "No date"}
                          {event.venue ? ` · ${event.venue}` : ""}
                        </p>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={padsHref}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-[#CFFF81] hover:text-white"
                        >
                          Song Garden
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="rounded-lg border border-[#CFFF81]/40 px-3 py-1.5 text-xs font-medium text-[#CFFF81] hover:bg-[#CFFF81]/10"
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
        </div>
      )}
    </div>
  );
}

export default function ComposerPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading Composer…</p>}>
      <ComposerPageInner />
    </Suspense>
  );
}
