"use client";

import { AnimatePresence, motion } from "framer-motion";

type MomentOverlayProps = {
  /** Unique per creative moment — changing this cross-fades content without navigating. */
  momentKey: string;
  eyebrow?: string;
  accentColor: string;
  /** World primary — tints the glass so it feels like the garden, not a gray sheet. */
  primaryColor: string;
  children: React.ReactNode;
};

/**
 * Tinted glass moment panel — world-colored wash, open enough to read the
 * video through it, with soft contrast so prompts stay legible.
 */
export default function MomentOverlay({
  momentKey,
  eyebrow,
  accentColor,
  primaryColor,
  children,
}: MomentOverlayProps) {
  return (
    <div className="mx-auto flex w-full min-h-0 max-w-lg flex-1 flex-col justify-center px-4 py-6 sm:px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={momentKey}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.99 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl p-6 sm:p-8"
          style={{
            background: `linear-gradient(
              165deg,
              color-mix(in srgb, ${primaryColor} 42%, transparent) 0%,
              color-mix(in srgb, ${primaryColor} 22%, transparent) 55%,
              color-mix(in srgb, ${accentColor} 12%, transparent) 100%
            )`,
            backdropFilter: "blur(7px) saturate(1.35)",
            WebkitBackdropFilter: "blur(7px) saturate(1.35)",
            border: `1px solid color-mix(in srgb, ${accentColor} 38%, transparent)`,
            boxShadow: `
              0 16px 40px -24px color-mix(in srgb, ${primaryColor} 70%, transparent),
              inset 0 1px 0 color-mix(in srgb, ${accentColor} 22%, transparent)
            `,
          }}
        >
          {eyebrow && (
            <p
              className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.25em]"
              style={{
                color: accentColor,
                textShadow: "0 1px 10px rgba(0,0,0,0.45)",
              }}
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
