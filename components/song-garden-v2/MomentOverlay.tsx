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
 * The overlay "window" into the world. WorldStage never remounts underneath this —
 * only this card's content cross-fades, which is what replaces traditional page
 * transitions between creative moments.
 */
export default function MomentOverlay({ momentKey, eyebrow, accentColor, children }: MomentOverlayProps) {
  return (
    <div className="mx-auto flex w-full min-h-0 max-w-lg flex-1 flex-col justify-center px-4 py-6 sm:px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={momentKey}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.99 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-md sm:p-8"
          style={{ boxShadow: `0 0 48px -24px ${accentColor}44` }}
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
