"use client";

import { motion } from "framer-motion";

type WorldProgressTrailProps = {
  completed: number;
  total: number;
  accentColor: string;
};

const MAX_DOTS = 10;

/** Duolingo-style dot trail — a glanceable "how far through the world am I" instead of a form-style progress bar. */
export default function WorldProgressTrail({ completed, total, accentColor }: WorldProgressTrailProps) {
  if (total <= 0) return null;
  const dotCount = Math.min(MAX_DOTS, total);
  const filledDots = Math.round((completed / total) * dotCount);

  return (
    <div className="flex items-center justify-center gap-1.5" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}>
      {Array.from({ length: dotCount }, (_, i) => {
        const filled = i < filledDots;
        return (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: filled ? accentColor : "rgba(255,255,255,0.18)" }}
            initial={false}
            animate={{ scale: filled ? [1, 1.35, 1] : 1 }}
            transition={{ duration: 0.4 }}
          />
        );
      })}
    </div>
  );
}
