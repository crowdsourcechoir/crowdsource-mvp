"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { buildAmbientLines, useAmbientActivity } from "@/lib/song-garden-v2/presence";

type WorldPresenceTickerProps = {
  eventId: string;
  accentColor: string;
};

const LINE_VISIBLE_MS = 5200;
const LINE_INTERVAL_MS = 9000;

/**
 * The "other people are here too" signal — a quiet, rotating ambient line near the
 * edge of the world. Prefers real aggregate activity (never individual content);
 * only blends in generic simulated lines when real recent activity is near zero,
 * per WorldConfig.presenceSimulationEnabled.
 */
export default function WorldPresenceTicker({ eventId, accentColor }: WorldPresenceTickerProps) {
  const summary = useAmbientActivity(eventId);
  const [lineIndex, setLineIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = window.setInterval(() => {
      setVisible(true);
      setLineIndex((n) => n + 1);
      window.setTimeout(() => setVisible(false), LINE_VISIBLE_MS);
    }, LINE_INTERVAL_MS);
    const firstShow = window.setTimeout(() => setVisible(true), 1800);
    return () => {
      window.clearInterval(showTimer);
      window.clearTimeout(firstShow);
    };
  }, []);

  const lines = buildAmbientLines(summary, true);
  if (!lines.length) return null;
  const line = lines[lineIndex % lines.length];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex justify-center px-4">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={`${lineIndex}-${line}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide backdrop-blur-md"
            style={{
              borderColor: `${accentColor}44`,
              background: "rgba(0,0,0,0.28)",
              color: accentColor,
            }}
          >
            {line}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
