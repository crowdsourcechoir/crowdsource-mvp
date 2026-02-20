"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getAllEvents } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import EventCardTimeline, { formatTimelineDate } from "@/components/EventCardTimeline";

function isUpcoming(event: Event): boolean {
  const eventDate = new Date(`${event.date}T23:59:59`);
  return eventDate >= new Date();
}

export default function AdminEventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");

  function refreshEvents() {
    setEvents(getAllEvents());
  }

  useEffect(() => {
    refreshEvents();
  }, []);

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
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Events</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/events/new"
            className="min-h-[44px] min-w-[44px] text-sm text-gray-500 hover:text-gray-300 sm:min-h-0 sm:min-w-0"
          >
            create
          </Link>
          <div className="flex rounded-lg border border-gray-700 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setFilter("upcoming")}
              className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition sm:min-h-0 ${
                filter === "upcoming" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setFilter("past")}
              className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition sm:min-h-0 ${
                filter === "past" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Past
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        {filtered.length > 0 && (
          <div
            className="absolute left-[5.5rem] top-0 bottom-0 w-0 border-l border-dashed border-gray-700 sm:left-[7.5rem]"
            aria-hidden
          />
        )}
        <ul className="space-y-4 sm:space-y-5">
          {filtered.map((event) => {
            const { short, dayOfWeek } = formatTimelineDate(event.date);
            return (
              <li key={event.id} className="relative flex items-start gap-3 sm:gap-4">
                <div className="w-20 shrink-0 pt-5 text-left sm:w-24">
                  <span className="block text-sm font-bold text-white">{short}</span>
                  <span className="block text-xs text-gray-500 sm:text-sm">{dayOfWeek}</span>
                </div>
                <div className="relative z-10 w-4 shrink-0">
                  <div
                    className="absolute left-1/2 top-6 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-600 bg-[#0c0c0e]"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <EventCardTimeline event={event} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-gray-500">
          {filter === "upcoming" ? "No upcoming events." : "No past events."}
        </p>
      )}
    </div>
  );
}
