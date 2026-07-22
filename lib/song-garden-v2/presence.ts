"use client";

import { useEffect, useRef, useState } from "react";

export type ActivitySummary = {
  participantsTotal: number;
  participantsRecent: number;
  clipsTotal: number;
  clipsRecent: number;
  windowMinutes: number;
};

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

/** Deliberately vague/atmospheric — never fabricates specific names, places, or counts that aren't real. */
const SIMULATED_AMBIENT_LINES = [
  "Another voice is warming up nearby",
  "The garden is stirring…",
  "Someone else is about to add a sound",
  "More of the crowd is joining in",
];

/**
 * Builds the rotating pool of ambient lines for one moment. Real, factual counts are
 * always preferred; generic simulated lines only fill in when real recent activity is
 * near zero (so a solo tester never sees an empty room) and only when the event allows it.
 */
export function buildAmbientLines(
  summary: ActivitySummary | null,
  simulationEnabled: boolean
): string[] {
  const lines: string[] = [];

  if (summary) {
    if (summary.participantsTotal > 1) {
      lines.push(
        `${summary.participantsTotal} people have shaped this world so far`
      );
    }
    if (summary.clipsRecent > 0) {
      lines.push(
        summary.clipsRecent === 1
          ? "Someone just added a sound to the garden"
          : `${summary.clipsRecent} sounds just landed in the garden`
      );
    }
    if (summary.participantsRecent > 0) {
      lines.push(
        summary.participantsRecent === 1
          ? "A new voice just joined"
          : `${summary.participantsRecent} new voices just joined`
      );
    }
  }

  const hasRealSignal = summary && summary.clipsRecent + summary.participantsRecent > 0;
  if (simulationEnabled && !hasRealSignal) {
    lines.push(...SIMULATED_AMBIENT_LINES);
  }

  return lines;
}
