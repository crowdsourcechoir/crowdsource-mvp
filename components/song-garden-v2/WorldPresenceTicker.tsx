"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { buildAmbientLines, useAmbientActivity } from "@/lib/song-garden-v2/presence";

type WorldPresenceTickerProps = {
  eventId: string;
  accentColor: string;
};

const LINE_VISIBLE_MS = 7500;
/** Quiet gap between lines — long enough that it feels ambient, not a carousel. */
const LINE_INTERVAL_MS = 18_000;
const FIRST_SHOW_DELAY_MS = 3200;

/**
 * Quiet ambient presence line under the title. Height is reserved so show/hide
 * never nudges the moment card.
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
    const firstShow = window.setTimeout(() => setVisible(true), FIRST_SHOW_DELAY_MS);
    return () => {
      window.clearInterval(showTimer);
      window.clearTimeout(firstShow);
    };
  }, []);

  const lines = buildAmbientLines(summary, true);
  const line = lines.length ? lines[lineIndex % lines.length] : null;

  return (
    <div className="pointer-events-none relative z-20 mx-auto mt-4 h-10 w-full max-w-lg shrink-0 px-4">
      <div className="absolute inset-x-0 top-0 flex justify-center">
        <AnimatePresence>
          {visible && line && (
            <motion.div
              key={`${lineIndex}-${line}`}
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
