"use client";

import { useEffect } from "react";
import { motion, animate, useMotionValue } from "framer-motion";

type WorldEnergyFieldProps = {
  accentColor: string;
  /** 0..1 — the *resting* level for the current storyboard stage; the field breathes around this. */
  baseIntensity: number;
  /** Bump (e.g. Date.now()) on every contribution — fires an instant bright pulse that eases back to baseIntensity, not to zero. */
  pulseTrigger: number;
};

/**
 * "Us, right now." A persistent glow whose resting brightness rises with each
 * storyboard stage, plus an instant pulse on every single submit that flares
 * brighter and settles back to the *current* resting level — the literal
 * "click → glows brighter → resets" behavior, always tied to real activity
 * rather than a decorative loop.
 */
export default function WorldEnergyField({ accentColor, baseIntensity, pulseTrigger }: WorldEnergyFieldProps) {
  const glow = useMotionValue(baseIntensity);
  const scale = useMotionValue(1);

  useEffect(() => {
    animate(glow, baseIntensity, { duration: 1.3, ease: "easeInOut" });
  }, [baseIntensity, glow]);

  useEffect(() => {
    if (pulseTrigger <= 0) return;
    const spike = Math.min(1, baseIntensity + 0.55);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    animate(glow, [spike, baseIntensity], { duration: 1.2, ease: "easeOut", times: [0, 1] });
    animate(scale, [1.18, 1], { duration: 1.2, ease: "easeOut", times: [0, 1] });
    // pulseTrigger is the only thing that should re-fire this; baseIntensity is read fresh each time via closure
  }, [pulseTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute left-1/2 top-1/2 h-[90vmax] w-[90vmax] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${accentColor}3d, ${accentColor}12 45%, transparent 70%)`,
          opacity: glow,
          scale,
        }}
      />
    </div>
  );
}
