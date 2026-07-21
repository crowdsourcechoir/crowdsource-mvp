"use client";

import { useCallback, useRef, useState } from "react";

/** The celebration is deliberately short — "roughly one second," per the product brief. */
export const CELEBRATION_MS = 900;

export type UseCelebrationResult = {
  /** Whether the celebration overlay should currently be visible. */
  active: boolean;
  /** Increments on every fire — feed to WorldStage to trigger a world-wide pulse. */
  trigger: number;
  /** Show the celebration, then call onDone once it finishes (~900ms later). */
  celebrate: (onDone?: () => void) => void;
  durationMs: number;
};

/**
 * The celebration engine's single implementation — every contribution type
 * (text, voice, video, sound pad) calls the same `celebrate()` so the
 * "Submit → accepted → transforms → world reacts → next moment" loop is
 * identical everywhere.
 */
export function useCelebration(): UseCelebrationResult {
  const [active, setActive] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const timerRef = useRef<number | null>(null);

  const celebrate = useCallback((onDone?: () => void) => {
    setActive(true);
    setTrigger((n) => n + 1);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setActive(false);
      onDone?.();
    }, CELEBRATION_MS);
  }, []);

  return { active, trigger, celebrate, durationMs: CELEBRATION_MS };
}
