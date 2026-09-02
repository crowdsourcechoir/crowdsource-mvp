"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildAmbientLinePool,
  pickNextAmbientLine,
  randomBetween,
  useAmbientActivity,
} from "@/lib/song-garden-v2/presence";

type WorldPresenceTickerProps = {
  eventId: string;
  accentColor: string;
  simulationEnabled?: boolean;
  /** Top margin — tighter when a logo sits above the bubble. */
  className?: string;
};

const LINE_VISIBLE_MS = { min: 5500, max: 8500 };
/** Quiet gap between lines — jittered so it feels ambient, not a carousel. */
const LINE_GAP_MS = { min: 22000, max: 42000 };
const FIRST_SHOW_DELAY_MS = { min: 2800, max: 4200 };

/**
 * Quiet ambient presence line under the title. Height is reserved so show/hide
 * never nudges the moment card.
 */
export default function WorldPresenceTicker({
  eventId,
  accentColor,
  simulationEnabled = true,
  className = "mt-4",
}: WorldPresenceTickerProps) {
  const summary = useAmbientActivity(eventId);
  const [line, setLine] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const lastLineRef = useRef<string | null>(null);
  const showIdRef = useRef(0);
  const summaryRef = useRef(summary);
  const simulationRef = useRef(simulationEnabled);
  summaryRef.current = summary;
  simulationRef.current = simulationEnabled;

  useEffect(() => {
    let cancelled = false;
    let hideTimer: number | undefined;
    let gapTimer: number | undefined;

    function scheduleNext(afterMs: number) {
      gapTimer = window.setTimeout(() => {
        if (cancelled) return;
        showLine();
      }, afterMs);
    }

    function showLine() {
      if (cancelled) return;
      const pool = buildAmbientLinePool(summaryRef.current, simulationRef.current);
      const picked = pickNextAmbientLine(pool, lastLineRef.current);
      if (!picked) {
        scheduleNext(randomBetween(LINE_GAP_MS.min, LINE_GAP_MS.max));
        return;
      }

      lastLineRef.current = picked.text;
      const showId = ++showIdRef.current;
      setLine(picked.text);
      setVisible(true);

      const visibleMs = randomBetween(LINE_VISIBLE_MS.min, LINE_VISIBLE_MS.max);
      hideTimer = window.setTimeout(() => {
        if (cancelled || showIdRef.current !== showId) return;
        setVisible(false);
        scheduleNext(randomBetween(LINE_GAP_MS.min, LINE_GAP_MS.max));
      }, visibleMs);
    }

    scheduleNext(randomBetween(FIRST_SHOW_DELAY_MS.min, FIRST_SHOW_DELAY_MS.max));

    return () => {
      cancelled = true;
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      if (gapTimer !== undefined) window.clearTimeout(gapTimer);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none relative z-20 mx-auto h-10 w-full max-w-lg shrink-0 px-4 ${className}`}
    >
      <div className="absolute inset-x-0 top-0 flex justify-center">
        <AnimatePresence>
          {visible && line && (
            <motion.div
              key={line}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
              className="rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide backdrop-blur-md"
              style={{
                borderColor: `${accentColor}44`,
                background: "rgba(0,0,0,0.35)",
                color: accentColor,
              }}
            >
              {line}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
