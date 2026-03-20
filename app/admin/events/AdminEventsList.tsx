"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getAllEvents } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import AdminEventCard from "@/components/AdminEventCard";
import { getAgentThemes, type AgentTheme } from "@/data/agentInterview";

function isUpcoming(event: Event): boolean {
  const eventDate = new Date(`${event.date}T23:59:59`);
  return eventDate >= new Date();
}

export default function AdminEventsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [baseUrl, setBaseUrl] = useState("https://crowdsource-mvp.vercel.app");
  const [themes, setThemes] = useState<AgentTheme[]>([]);
  const showCreatedBanner = searchParams.get("created") === "1";
  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  function refreshEvents() {
    setLoading(true);
    getAllEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refreshEvents();
  }, []);

  useEffect(() => {
    getAgentThemes()
      .then(setThemes)
      .catch(() => setThemes([]));
  }, []);

  /* Refetch when user navigates to this page so list stays in sync with local store */
  useEffect(() => {
    if (pathname === "/admin/events") refreshEvents();
  }, [pathname]);

  function clearCreatedParam() {
    router.replace("/admin/events", { scroll: false });
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshEvents();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const filtered = useMemo(() => {
    const list = events.filter((e) => (filter === "upcoming" ? isUpcoming(e) : !isUpcoming(e)));
    return list.sort((a, b) => {
      const dA = new Date(a.date).getTime();
      const dB = new Date(b.date).getTime();
      return filter === "upcoming" ? dA - dB : dB - dA;
    });
  }, [events, filter]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
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
          </div>
          <Link
            href="/admin/events/new"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-200"
          >
            + Create Event
          </Link>
        </div>
      </div>

      <ul className="space-y-4 sm:space-y-5">
        {filtered.map((event) => {
          const theme = event.agentThemeId ? themes.find((t) => t.id === event.agentThemeId) : null;
          const badgeLabel =
            theme?.key === "birthday"
              ? "Birthday"
              : theme?.key === "fundraiser"
                ? "Fundraiser"
                : "Other";
          return (
            <li key={event.id}>
              <AdminEventCard event={event} baseUrl={baseUrl} badgeLabel={badgeLabel} />
            </li>
          );
        })}
      </ul>

      {!loading && filtered.length === 0 && (
        <p className="mt-12 text-center text-gray-500">
          {filter === "upcoming" ? "No upcoming events." : "No past events."}
        </p>
      )}
    </div>
  );
}
