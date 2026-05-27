"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getAllEvents } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import AdminEventCard from "@/components/AdminEventCard";
import { getAgentThemes, type AgentTheme } from "@/data/agentInterview";
import AdminIndeterminateProgress from "@/components/AdminIndeterminateProgress";
import AdminEventsLoadingSkeleton from "@/components/AdminEventsLoadingSkeleton";
import { isEventUpcoming } from "@/lib/formatDate";

const LAST_CREATED_EVENT_KEY = "csc_last_created_event";

function isUpcoming(event: Event): boolean {
  return isEventUpcoming(event.date);
}

export default function AdminEventsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoadError, setEventsLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [baseUrl, setBaseUrl] = useState("https://app.crowdsourcechoir.com");
  const [themes, setThemes] = useState<AgentTheme[]>([]);
  const showCreatedBanner = searchParams.get("created") === "1";

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  /** Single parallel load — faster than sequential events + themes; avoids double-fetch on mount. */
  const loadData = useCallback(async () => {
    setLoading(true);
    const [eventsResult, themesResult] = await Promise.allSettled([getAllEvents(), getAgentThemes()]);
    if (eventsResult.status === "fulfilled") {
      setEventsLoadError(null);
      let list = Array.isArray(eventsResult.value) ? eventsResult.value : [];
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem(LAST_CREATED_EVENT_KEY);
        if (raw) {
          try {
            const created = JSON.parse(raw) as Event;
            sessionStorage.removeItem(LAST_CREATED_EVENT_KEY);
            if (created?.id && !list.some((e) => e.id === created.id)) {
              list = [created, ...list];
            }
          } catch {
            sessionStorage.removeItem(LAST_CREATED_EVENT_KEY);
          }
        }
      }
      setEvents(list);
    } else {
      const msg =
        eventsResult.reason instanceof Error ? eventsResult.reason.message : "Could not load events.";
      setEventsLoadError(msg);
      setEvents([]);
    }
    if (themesResult.status === "fulfilled") {
      setThemes(Array.isArray(themesResult.value) ? themesResult.value : []);
    } else {
      setThemes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (pathname !== "/admin/events") return;
    loadData();
  }, [pathname, loadData]);

  useEffect(() => {
    if (!showCreatedBanner) return;
    loadData();
    const retry = window.setTimeout(loadData, 800);
    return () => window.clearTimeout(retry);
  }, [showCreatedBanner, loadData]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && pathname === "/admin/events") loadData();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pathname, loadData]);

  function clearCreatedParam() {
    router.replace("/admin/events", { scroll: false });
  }

  const filtered = useMemo(() => {
    const list =
      filter === "all"
        ? [...events]
        : events.filter((e) => (filter === "upcoming" ? isUpcoming(e) : !isUpcoming(e)));
    return list.sort((a, b) => {
      const dA = new Date(a.date).getTime();
      const dB = new Date(b.date).getTime();
      return filter === "past" ? dB - dA : dA - dB;
    });
  }, [events, filter]);

  const showFullSkeleton = loading && events.length === 0;

  return (
    <div className="relative w-full text-white">
      {loading && <AdminIndeterminateProgress />}

      {eventsLoadError && (
        <div className="mb-6 rounded-xl border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <p className="font-medium">Events could not be loaded</p>
          <p className="mt-1 text-red-200/90">{eventsLoadError}</p>
          <p className="mt-2 text-xs text-red-300/80">
            In Supabase → SQL Editor, run <code className="rounded bg-black/30 px-1">supabase/prod-patch-events-columns.sql</code> (or the{" "}
            <code className="rounded bg-black/30 px-1">alter table … add column if not exists</code> block in{" "}
            <code className="rounded bg-black/30 px-1">supabase/events-table.sql</code>), then refresh.
          </p>
        </div>
      )}

      {showCreatedBanner && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-200">
          <span>Event created. Click it below to open.</span>
          <button type="button" onClick={clearCreatedParam} className="shrink-0 font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Events</h1>
        <p className="mt-2 text-sm text-gray-400">Manage public events for crowd-driven choir participation</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl border border-gray-700 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setFilter("upcoming")}
              className={`min-h-[44px] rounded-lg px-5 py-2 text-sm font-medium transition ${
                filter === "upcoming" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setFilter("past")}
              className={`min-h-[44px] rounded-lg px-5 py-2 text-sm font-medium transition ${
                filter === "past" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Past
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`min-h-[44px] rounded-lg px-5 py-2 text-sm font-medium transition ${
                filter === "all" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              All
            </button>
          </div>
          <Link
            href="/admin/events/new"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-200"
          >
            + Create Event
          </Link>
        </div>
      </div>

      {showFullSkeleton ? (
        <AdminEventsLoadingSkeleton />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-700/60 bg-[#18181b]">
          <ul className="divide-y divide-gray-800/80">
          {filtered.map((event) => {
            const theme = event.agentThemeId ? themes.find((t) => t.id === event.agentThemeId) : null;
            const badgeLabel =
              theme?.key === "birthday"
                ? "Birthday"
                : theme?.key === "fundraiser"
                  ? "Fundraiser"
                  : "Other";
            return (
              <li key={event.id} className="p-1 sm:p-2">
                <AdminEventCard event={event} baseUrl={baseUrl} badgeLabel={badgeLabel} />
              </li>
            );
          })}
          </ul>
        </div>
      )}

      {!loading && !eventsLoadError && filtered.length === 0 && (
        <div className="mt-12 space-y-2 text-center text-gray-500">
          <p>
            {events.length === 0
              ? filter === "upcoming"
                ? "No upcoming events."
                : filter === "past"
                  ? "No past events."
                  : "No events yet."
              : filter === "upcoming"
                ? "No upcoming events — check the Past or All tab, or set the event date to today or later."
                : filter === "past"
                  ? "No past events — try Upcoming or All."
                  : "No events found."}
          </p>
          {events.length > 0 && filter === "upcoming" && (
            <p className="text-sm text-gray-400">
              You have {events.length} event{events.length === 1 ? "" : "s"} total.{" "}
              <button type="button" className="font-medium text-blue-400 hover:underline" onClick={() => setFilter("past")}>
                Show Past
              </button>
            </p>
          )}
          {events.length > 0 && filter === "past" && (
            <p className="text-sm text-gray-400">
              <button type="button" className="font-medium text-blue-400 hover:underline" onClick={() => setFilter("upcoming")}>
                Show Upcoming
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
