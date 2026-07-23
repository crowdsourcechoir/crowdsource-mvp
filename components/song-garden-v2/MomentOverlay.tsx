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
 * Frosted glass moment panel — light enough that the world stays visible, strong
 * enough that prompts and controls stay readable on busy video.
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
          className="rounded-3xl border border-white/15 p-6 sm:p-8"
          style={{
            background: "rgba(12, 12, 16, 0.38)",
            backdropFilter: "blur(14px) saturate(1.1)",
            WebkitBackdropFilter: "blur(14px) saturate(1.1)",
            boxShadow: `0 12px 48px -20px rgba(0,0,0,0.55), 0 0 0 1px ${accentColor}18`,
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
