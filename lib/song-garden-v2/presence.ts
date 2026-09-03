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
/** Defer ambient reads until after first paint / first interaction window. */
const FIRST_POLL_DELAY_MS = 8_000;

/** Best-effort poll of the read-only activity-summary endpoint. Never throws into the UI. */
export function useAmbientActivity(eventId: string): ActivitySummary | null {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const eventIdRef = useRef(eventId);
  eventIdRef.current = eventId;

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/events/${eventIdRef.current}/activity`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ActivitySummary;
        if (!cancelled) setSummary(data);
      } catch {
        // ambient signal only — ignore failures
      }
    }

    const startTimer = window.setTimeout(() => {
      void poll();
      interval = window.setInterval(poll, POLL_MS);
    }, FIRST_POLL_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (interval != null) window.clearInterval(interval);
    };
  }, [eventId]);

  return summary;
}
