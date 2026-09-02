"use client";

import { AnimatePresence, motion } from "framer-motion";
import TypewriterText from "@/components/TypewriterText";
import WorldProgressTrail from "./WorldProgressTrail";

type MomentOverlayProps = {
  /** Unique per creative moment — changing this cross-fades content without navigating. */
  momentKey: string;
  eyebrow?: string;
  accentColor: string;
  /** World primary — tints the glass so it feels like the garden, not a gray sheet. */
  primaryColor: string;
  /** When set, dot trail renders at the top of the prompt card. */
  progress?: { completed: number; total: number } | null;
  children: React.ReactNode;
};

/**
 * World-tinted glass panel. Dense enough for contrast over bright video, with
 * a little garden still reading through.
 */
export default function MomentOverlay({
  momentKey,
  eyebrow,
  accentColor,
  primaryColor,
  progress,
  children,
}: MomentOverlayProps) {
  return (
    <div className="mx-auto flex w-full min-h-0 max-w-lg flex-1 flex-col justify-center overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={momentKey}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.99 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl p-5 sm:p-8"
          style={{
            background: `linear-gradient(
              165deg,
              color-mix(in srgb, ${primaryColor} 82%, transparent) 0%,
              color-mix(in srgb, ${primaryColor} 74%, transparent) 50%,
              color-mix(in srgb, color-mix(in srgb, ${primaryColor} 88%, ${accentColor}) 70%, transparent) 100%
            )`,
            backdropFilter: "blur(14px) saturate(1.12)",
            WebkitBackdropFilter: "blur(14px) saturate(1.12)",
            border: `1px solid color-mix(in srgb, ${accentColor} 48%, transparent)`,
            boxShadow: `
              0 18px 48px -18px rgba(0,0,0,0.6),
              inset 0 1px 0 color-mix(in srgb, ${accentColor} 30%, transparent)
            `,
          }}
        >
          {progress && progress.total > 0 ? (
            <div className="mb-4">
              <WorldProgressTrail
                completed={progress.completed}
                total={progress.total}
                accentColor={accentColor}
              />
            </div>
          ) : null}
          {eyebrow && (
            <p
              className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.25em]"
              style={{
                color: accentColor,
                textShadow: "0 1px 2px rgba(0,0,0,0.75), 0 0 16px rgba(0,0,0,0.4)",
              }}
            >
              <TypewriterText key={eyebrow} text={eyebrow} speed={9} className="inline" />
            </p>
          )}
          <div style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7), 0 2px 14px rgba(0,0,0,0.4)" }}>
            {children}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
