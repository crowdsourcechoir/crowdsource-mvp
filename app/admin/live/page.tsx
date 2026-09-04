"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getAllEvents } from "@/data/eventsClient";
import { createSession } from "@/data/livePromptGame";
import type { Event } from "@/data/mockEvents";

type LiveMode = "game" | "fishbowl" | "signal";

function ModeIcon({ mode }: { mode: LiveMode }) {
  const common = "h-7 w-7";
  switch (mode) {
    case "fishbowl":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="10" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5 10c1.5 2.2 4 3.5 7 3.5s5.5-1.3 7-3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9.2 10.2c1.2-1.6 3.2-1.6 4.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M14.5 8.8l2-1.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="14.7" cy="9.1" r="1" fill="currentColor" />
          <path d="M7.2 18.2c1.2 1.1 2.8 1.8 4.8 1.8s3.6-.7 4.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "signal":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 10v4h4l9 6V4l-9 6H4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M17 9c1.2 1.2 1.2 4.8 0 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M19.5 7c2.2 2.2 2.2 7.8 0 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "game":
    default:
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none">
          <path
            d="M7 9h-.5a3 3 0 0 0-2.6 1.5l-1.1 2A3 3 0 0 0 3.3 17l.7.9c.8 1.1 2.2 1.6 3.5 1.2l1.5-.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M17 9h.5a3 3 0 0 1 2.6 1.5l1.1 2A3 3 0 0 1 20.7 17l-.7.9c-.8 1.1-2.2 1.6-3.5 1.2l-1.5-.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M8 12h0"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M10.5 10.5l-2 2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M10.5 13.5l-2-2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="16.5" cy="12" r="1.2" fill="currentColor" />
          <path
            d="M9.5 9.5h5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function modeTileStyle(mode: LiveMode, active: boolean) {
  if (!active) return "border-gray-700 bg-black/20 text-gray-300 hover:text-white hover:border-gray-600";
  if (mode === "game") return "border-[#CFFF81]/60 bg-[#CFFF81]/10 text-white border-[1px] shadow-[0_0_0_1px_rgba(207,255,129,0.3)]";
  if (mode === "fishbowl") return "border-purple-500/60 bg-purple-500/15 text-white border-[1px] shadow-[0_0_0_1px_rgba(168,85,247,0.4)]";
  return "border-amber-500/60 bg-amber-500/15 text-white border-[1px] shadow-[0_0_0_1px_rgba(245,158,11,0.4)]";
}

export default function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<LiveMode>("game");
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [launching, setLaunching] = useState(false);

  const eventIdParam = searchParams.get("eventId");
  const initialEventId = eventIdParam && eventIdParam.trim().length > 0 ? eventIdParam : null;
  const [assignedEventId, setAssignedEventId] = useState<string | null>(initialEventId);

  useEffect(() => {
    // Keep the assigned event synced with the query param for deep links.
    setAssignedEventId(initialEventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdParam]);

  useEffect(() => {
    setLoadingEvents(true);
    getAllEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  const assignedEvent = useMemo(() => events.find((e) => e.id === assignedEventId) ?? null, [events, assignedEventId]);

  async function handleLaunchSession() {
    setLaunching(true);
    try {
      const session = await createSession({
        linkedEventId: assignedEventId,
        name:
          mode === "game" ? "Game" : mode === "fishbowl" ? "Fishbowl" : "Signal",
      });
      router.push(`/admin/live-prompt-game/sessions/${session.id}`);
    } catch (e) {
      console.error(e);
      // Let the dev server logs show the exact error; we keep the UI clean.
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="text-white">
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
            Runtime Tools
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Live</h1>
          <p className="mt-2 text-sm text-gray-400">
            Runtime tools for Blooms: prompts, signal play, and live participation moments.
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-white/10 bg-transparent p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white sm:text-xl">Start Session</h2>
        <p className="mt-2 text-sm text-gray-400">Select a mode and optionally assign it to a Bloom</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["game", "fishbowl", "signal"] as LiveMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`relative rounded-2xl border p-4 text-left transition ${modeTileStyle(m, mode === m)}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-white">
                  <ModeIcon mode={m} />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-white">
                    {m === "game" ? "Game" : m === "fishbowl" ? "Fishbowl" : "Signal"}
                  </div>
                  <div className="mt-1 text-xs text-gray-300">
                    {m === "game"
                      ? "Answer fun prompts in a game format"
                      : m === "fishbowl"
                        ? "Contribute thoughts moving in a circle"
                        : "Find the signal from the noise."}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <label className="block text-sm font-medium text-gray-300">Assign to Bloom</label>
          <select
            value={assignedEventId ?? ""}
            onChange={(e) => setAssignedEventId(e.target.value ? e.target.value : null)}
            className="w-full rounded-lg border border-gray-700 bg-black/30 px-3 py-2 text-sm text-white focus:border-gray-600 focus:outline-none"
            disabled={loadingEvents}
          >
            <option value="">{`None (standalone session)`}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          {assignedEventId && assignedEvent && (
            <p className="text-xs text-gray-400">
              Linked to: <span className="text-gray-200">{assignedEvent.title}</span>
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
          <button
            type="button"
            disabled={launching}
            onClick={handleLaunchSession}
            className="rounded-lg bg-[#CFFF81] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#bdf25e] disabled:opacity-50"
          >
            {launching ? "Launching…" : "Launch Session"}
          </button>
        </div>

        <div className="mt-3">
          <Link
            href="/admin/live-prompt-game/sessions"
            className="inline-flex text-sm font-medium text-gray-400 hover:text-gray-200"
          >
            View Past Sessions &gt;
          </Link>
        </div>
      </section>
    </div>
  );
}

