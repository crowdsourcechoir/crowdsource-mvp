"use client";

import { AnimatePresence, motion } from "framer-motion";

type MomentOverlayProps = {
  /** Unique per creative moment — changing this cross-fades content without navigating. */
  momentKey: string;
  eyebrow?: string;
  accentColor: string;
  children: React.ReactNode;
};

/**
 * Moment content over the world — no card panel. Legibility comes from soft text
 * shadow so the environment stays sharp (backdrop-blur was frosting the videos).
 */
export default function MomentOverlay({ momentKey, eyebrow, accentColor, children }: MomentOverlayProps) {
  return (
    <div className="mx-auto flex w-full min-h-0 max-w-lg flex-1 flex-col justify-center px-4 py-6 sm:px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={momentKey}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="px-1 py-2 sm:px-2"
          style={{
            textShadow:
              "0 1px 2px rgba(0,0,0,0.85), 0 4px 28px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.9)",
          }}
        >
          {eyebrow && (
            <p
              className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.25em]"
              style={{ color: accentColor }}
            >
              {eyebrow}
            </p>
          )}
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
