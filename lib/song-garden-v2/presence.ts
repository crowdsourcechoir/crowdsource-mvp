"use client";

import { useEffect, useRef, useState } from "react";

export type { ActivitySummary, AmbientLine, AmbientLineKind } from "./presence-lines";
export {
  PARTICIPANT_COUNT_THRESHOLD,
  buildAmbientLinePool,
  buildAmbientLines,
  pickNextAmbientLine,
  randomBetween,
} from "./presence-lines";

import type { ActivitySummary } from "./presence-lines";

const POLL_MS = 25_000;

/** Best-effort poll of the read-only activity-summary endpoint. Never throws into the UI. */
export function useAmbientActivity(eventId: string): ActivitySummary | null {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const eventIdRef = useRef(eventId);
  eventIdRef.current = eventId;

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/events/${eventIdRef.current}/activity`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ActivitySummary;
        if (!cancelled) setSummary(data);
      } catch {
        // ambient signal only — ignore failures
      }
    }
    void poll();
    const interval = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [eventId]);

  return summary;
}
