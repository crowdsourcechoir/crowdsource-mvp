"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CELEBRATION_MS } from "./engine/useCelebration";

type CelebrationBurstProps = {
  active: boolean;
  accentColor: string;
  message?: string;
};

const SPARKLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * The emotional core of Song Garden V2: a short (~1s), Duolingo-inspired burst
 * of motion — no badges, no points, no XP. Just light, motion, and a one-line
 * affirmation that the world just changed because of this contribution.
 */
export default function CelebrationBurst({ active, accentColor, message }: CelebrationBurstProps) {
  const seconds = useMemo(() => CELEBRATION_MS / 1000, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <motion.span
            className="absolute rounded-full"
            style={{ border: `2px solid ${accentColor}`, width: 40, height: 40 }}
            initial={{ scale: 0.4, opacity: 0.95 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: seconds, ease: "easeOut" }}
          />
          {SPARKLE_ANGLES.map((angle) => (
            <motion.span
              key={angle}
              className="absolute h-2 w-2 rounded-full"
              style={{ background: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((angle * Math.PI) / 180) * 90,
                y: Math.sin((angle * Math.PI) / 180) * 90,
                opacity: 0,
                scale: 0.4,
              }}
              transition={{ duration: seconds * 0.9, ease: "easeOut" }}
            />
          ))}
          {message && (
            <motion.p
              className="relative font-mono text-sm font-medium tracking-wide"
              style={{ color: accentColor }}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: -36, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: seconds * 0.8, ease: "easeOut" }}
            >
              {message}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
