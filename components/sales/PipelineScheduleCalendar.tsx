"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  groupPipelineByDay,
  monthGridDays,
  pipelineCategoryLabel,
  shiftMonth,
  shiftWeek,
  todayYmd,
  weekGridDays,
  type PipelineScheduleEvent,
} from "@/lib/sales/calendar/pipeline-schedule";
import { formatUsd } from "@/lib/sales/engines";
import type { QueueCategoryKey } from "@/lib/sales/queue/category";
import { QUEUE_CATEGORY_CHIPS } from "@/lib/sales/queue/category";
import { publicErrorMessage } from "@/lib/sales/http-error";

type ViewMode = "month" | "week";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CATEGORY_DOT: Record<QueueCategoryKey, string> = {
  conferences: "bg-[var(--csc-accent)]",
  fundraisers: "bg-rose-400",
  sports: "bg-sky-400",
  tech: "bg-violet-400",
  arts: "bg-amber-400",
  entertainment: "bg-emerald-400",
};

function monthTitle(year: number, monthIndex0: number): string {
  return new Date(Date.UTC(year, monthIndex0, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dayNumber(ymd: string): string {
  return String(Number(ymd.slice(8, 10)));
}

function formatListDay(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function stageLabel(stage: PipelineScheduleEvent["relationshipStage"]): string {
  if (stage === "interest") return "Interest";
  if (stage === "awareness") return "Awareness";
  if (stage === "purchase") return "Won";
  if (stage === "lost") return "Lost";
  return "Unstaged";
}

export default function PipelineScheduleCalendar() {
  const today = todayYmd();
  const [events, setEvents] = useState<PipelineScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("month");
  const [category, setCategory] = useState<"all" | QueueCategoryKey>("all");
  const [cursorYear, setCursorYear] = useState(() => Number(today.slice(0, 4)));
  const [cursorMonth, setCursorMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState<string | null>(today);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/calendar/pipeline", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load schedule");
      setEvents(Array.isArray(data.events) ? data.events : []);
      setError(null);
    } catch (err) {
      setError(publicErrorMessage(err, "Failed to load schedule"));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (category === "all") return events;
    return events.filter((e) => e.category === category);
  }, [events, category]);

  const byDay = useMemo(() => {
    const map = new Map<string, PipelineScheduleEvent[]>();
    for (const day of groupPipelineByDay(filtered)) {
      map.set(day.date, day.events);
    }
    return map;
  }, [filtered]);

  const gridDays = useMemo(() => {
    if (view === "week") return weekGridDays(weekAnchor);
    return monthGridDays(cursorYear, cursorMonth);
  }, [view, weekAnchor, cursorYear, cursorMonth]);

  const selectedEvents = selectedDay ? byDay.get(selectedDay) ?? [] : [];
  const overlapCount = useMemo(
    () => groupPipelineByDay(filtered).filter((d) => d.overlap).length,
    [filtered]
  );

  function goToday() {
    setCursorYear(Number(today.slice(0, 4)));
    setCursorMonth(Number(today.slice(5, 7)) - 1);
    setWeekAnchor(today);
    setSelectedDay(today);
  }

  function prev() {
    if (view === "week") setWeekAnchor((a) => shiftWeek(a, -1));
    else {
      const next = shiftMonth(cursorYear, cursorMonth, -1);
      setCursorYear(next.year);
      setCursorMonth(next.monthIndex0);
    }
  }

  function next() {
    if (view === "week") setWeekAnchor((a) => shiftWeek(a, 1));
    else {
      const nextM = shiftMonth(cursorYear, cursorMonth, 1);
      setCursorYear(nextM.year);
      setCursorMonth(nextM.monthIndex0);
    }
  }

  const headerTitle =
    view === "week"
      ? `${formatListDay(gridDays[0])} – ${formatListDay(gridDays[6])}`
      : monthTitle(cursorYear, cursorMonth);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="csc-eyebrow">Pipeline schedule</p>
          <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{headerTitle}</h2>
          <p className="mt-1 text-sm text-gray-400">
            Potential conferences, fundraisers, and events from estimated dates. Overlap days are
            marked so you can spot conflicts. Click an event to open it in the queue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-gray-200 hover:border-white/40"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-gray-200 hover:border-white/40"
          >
            Today
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-gray-200 hover:border-white/40"
          >
            →
          </button>
          {(
            [
              ["month", "Month"],
              ["week", "Week"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                view === id
                  ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
                  : "border-white/20 text-gray-300 hover:border-white/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {QUEUE_CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setCategory(chip.key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              category === chip.key
                ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
                : "border-white/20 text-gray-300 hover:border-white/40"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        {loading
          ? "Loading…"
          : `${filtered.length} dated opportunit${filtered.length === 1 ? "y" : "ies"} · ${overlapCount} overlap day${overlapCount === 1 ? "" : "s"}`}
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div
        className={`grid gap-px overflow-hidden rounded-xl border border-[var(--csc-row-divider)] bg-[var(--csc-row-divider)] ${
          view === "week" ? "grid-cols-7" : "grid-cols-7"
        }`}
      >
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-black px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {d}
          </div>
        ))}
        {gridDays.map((ymd) => {
          const dayEvents = byDay.get(ymd) ?? [];
          const inMonth =
            view === "week" ||
            (Number(ymd.slice(0, 4)) === cursorYear && Number(ymd.slice(5, 7)) - 1 === cursorMonth);
          const isToday = ymd === today;
          const isSelected = ymd === selectedDay;
          const overlap = dayEvents.length > 1;
          const show = view === "week" ? dayEvents : dayEvents.slice(0, 3);
          const more = view === "week" ? 0 : Math.max(0, dayEvents.length - 3);

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => setSelectedDay(ymd)}
              className={`min-h-[5.5rem] bg-black p-1.5 text-left transition-colors hover:bg-white/[0.03] sm:min-h-[7rem] ${
                !inMonth ? "opacity-40" : ""
              } ${isSelected ? "ring-1 ring-inset ring-[var(--csc-accent)]" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-[var(--csc-accent)] font-semibold text-black"
                      : "text-gray-300"
                  }`}
                >
                  {dayNumber(ymd)}
                </span>
                {overlap ? (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400">
                    Overlap
                  </span>
                ) : null}
              </div>
              <ul className="space-y-0.5">
                {show.map((event) => (
                  <li key={event.opportunityId}>
                    <Link
                      href={event.href}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 text-[10px] leading-tight text-gray-200 no-underline hover:border-[var(--csc-accent)] hover:text-white"
                      title={`${event.organizationName} — open in queue`}
                    >
                      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[event.category]}`} />
                      {event.organizationName}
                    </Link>
                  </li>
                ))}
                {more > 0 ? (
                  <li className="px-1 text-[10px] text-gray-500">+{more} more</li>
                ) : null}
              </ul>
            </button>
          );
        })}
      </div>

      <section className="rounded-xl border border-[var(--csc-row-divider)] bg-black">
        <div className="border-b border-[var(--csc-row-divider)] px-4 py-3">
          <p className="text-sm font-medium text-white">
            {selectedDay ? formatListDay(selectedDay) : "Select a day"}
            {selectedEvents.length > 1 ? (
              <span className="ml-2 text-xs font-normal text-amber-400">
                {selectedEvents.length} events · overlap
              </span>
            ) : null}
          </p>
        </div>
        {!selectedDay ? (
          <p className="px-4 py-6 text-sm text-gray-500">Tap a day to list conferences and events.</p>
        ) : selectedEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No dated opportunities this day.</p>
        ) : (
          <ul className="csc-list">
            {selectedEvents.map((event) => (
              <li key={event.opportunityId}>
                <Link
                  href={event.href}
                  className="csc-list-row flex items-start justify-between gap-3 no-underline hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${CATEGORY_DOT[event.category]}`} />
                      {event.organizationName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{event.title}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-600">
                      {pipelineCategoryLabel(event.category)}
                      {" · "}
                      {stageLabel(event.relationshipStage)}
                      {event.eventDateConfidence ? ` · ${event.eventDateConfidence}` : ""}
                      {event.potentialAmount != null ? ` · ${formatUsd(event.potentialAmount)}` : ""}
                    </p>
                  </div>
                  <span className="csc-link shrink-0 text-xs">
                    {event.queueItemId ? "Open in queue →" : "Open org →"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
