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
import { draftToRestorePayload, readEventFormDraft } from "@/lib/event-form-draft";

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
  const [orphans, setOrphans] = useState<Array<{ prefix: string; frameCount: number }>>([]);
  const [recoveringPrefix, setRecoveringPrefix] = useState<string | null>(null);
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
    void fetch("/api/events/storyboard-orphans", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        setOrphans(Array.isArray(body?.orphans) ? body.orphans : []);
      })
      .catch(() => setOrphans([]));
  }, []);

  async function recoverOrphan(prefix: string) {
    setRecoveringPrefix(prefix);
    try {
      const draft = readEventFormDraft();
      const draftPayload =
        draft &&
        (!draft.slug.trim() ||
          draft.slug.trim().toLowerCase() === prefix.toLowerCase() ||
          Date.now() - draft.savedAt < 48 * 60 * 60 * 1000)
          ? draftToRestorePayload(draft)
          : {};
      const res = await fetch("/api/events/storyboard-orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, ...draftPayload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || "Recover failed");
      const id = (body as { event?: { id?: string }; eventId?: string }).event?.id
        || (body as { eventId?: string }).eventId;
      const promptsRestored = Boolean((body as { promptsRestored?: boolean }).promptsRestored);
      await loadData();
      if (id) {
        router.push(
          promptsRestored
            ? `/admin/events/${id}/edit?restoredPrompts=1`
            : `/admin/events/${id}`
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not recover world.");
    } finally {
      setRecoveringPrefix(null);
    }
  }

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
          <p className="font-medium">Blooms could not be loaded</p>
          <p className="mt-1 text-red-200/90">{eventsLoadError}</p>
          <p className="mt-2 text-xs text-red-300/80">
            {eventsLoadError.toLowerCase().includes("timeout")
              ? "The blooms list query timed out — usually a huge hero image stored inline. Refresh after this deploy; the list no longer loads those blobs. Your bloom may already be saved."
              : "If this mentions a missing column, run supabase/prod-patch-events-columns.sql in the Supabase SQL Editor, then refresh."}
          </p>
        </div>
      )}

      {orphans.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">Unattached generated worlds</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Runway stills/loops are in storage but not on a bloom yet — restore so those credits
            aren’t lost. If you still have a form draft in this browser, journey prompts are
            restored with the world.
          </p>
          <ul className="mt-3 space-y-2">
            {orphans.map((o) => (
              <li key={o.prefix} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  {o.prefix} · {o.frameCount} frame{o.frameCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  disabled={recoveringPrefix === o.prefix}
                  onClick={() => void recoverOrphan(o.prefix)}
                  className="rounded-lg bg-[#CFFF81] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#bdf25e] disabled:opacity-50"
                >
                  {recoveringPrefix === o.prefix ? "Restoring…" : "Restore bloom"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showCreatedBanner && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-200">
          <span>Bloom created. Click it below to open.</span>
          <button type="button" onClick={clearCreatedParam} className="shrink-0 font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Live Events
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Blooms</h1>
        <p className="mt-2 text-sm text-gray-400">
          Manage live events, gameday moments, and activations where Gardens come alive.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex gap-1.5">
            {(["upcoming", "past", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f
                    ? "bg-[#CFFF81]/15 text-[#CFFF81] border border-[#CFFF81]/30"
                    : "border border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Link
            href="/admin/events/new"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black hover:bg-[#bdf25e] sm:w-auto"
          >
            + Create Bloom
          </Link>
        </div>
      </div>

      {showFullSkeleton ? (
        <AdminEventsLoadingSkeleton />
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const theme = event.agentThemeId ? themes.find((t) => t.id === event.agentThemeId) : null;
            const badgeLabel =
              theme?.key === "birthday"
                ? "Birthday"
                : theme?.key === "fundraiser"
                  ? "Fundraiser"
                  : "Other";
            return (
              <AdminEventCard
                key={event.id}
                event={event}
                baseUrl={baseUrl}
                badgeLabel={badgeLabel}
                onDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
              />
            );
          })}
        </div>
      )}

      {!loading && !eventsLoadError && filtered.length === 0 && (
        <div className="mt-12 space-y-2 text-center text-gray-500">
          <p>
            {events.length === 0
              ? filter === "upcoming"
                ? "No upcoming blooms."
                : filter === "past"
                  ? "No past blooms."
                  : "No blooms yet."
              : filter === "upcoming"
                ? "No upcoming blooms — check the Past or All tab, or set the date to today or later."
                : filter === "past"
                  ? "No past blooms — try Upcoming or All."
                  : "No blooms found."}
          </p>
          {events.length > 0 && filter === "upcoming" && (
            <p className="text-sm text-gray-400">
              You have {events.length} bloom{events.length === 1 ? "" : "s"} total.{" "}
              <button type="button" className="font-medium text-[#CFFF81] hover:underline" onClick={() => setFilter("past")}>
                Show Past
              </button>
            </p>
          )}
          {events.length > 0 && filter === "past" && (
            <p className="text-sm text-gray-400">
              <button type="button" className="font-medium text-[#CFFF81] hover:underline" onClick={() => setFilter("upcoming")}>
                Show Upcoming
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
