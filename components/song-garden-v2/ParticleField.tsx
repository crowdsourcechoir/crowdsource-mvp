"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { WorldAnimationPreset } from "@/lib/song-garden-v2/world-config";

type ParticleFieldProps = {
  preset: WorldAnimationPreset;
  accentColor: string;
  /** 0..1 — how "alive" the world feels; grows as the participant contributes. */
  energy: number;
};

type Seed = { x: number; y: number; size: number; delay: number; duration: number };

function makeSeeds(count: number, seedBase: number): Seed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + seedBase;
    const pseudoRandom = (k: number) => {
      const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    return {
      x: pseudoRandom(1) * 100,
      y: pseudoRandom(2) * 100,
      size: 3 + pseudoRandom(3) * 7,
      delay: pseudoRandom(4) * 4,
      duration: 6 + pseudoRandom(5) * 10,
    };
  });
}

/** Ambient background motion. Pure CSS-driven Framer Motion — no canvas, keeps mobile perf high. */
export default function ParticleField({ preset, accentColor, energy }: ParticleFieldProps) {
  const particleCount = useMemo(() => Math.round(10 + energy * 26), [energy]);
  const seeds = useMemo(() => makeSeeds(particleCount, 7), [particleCount]);

  if (preset === "none") return null;

  if (preset === "aurora") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute -inset-1/4 rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${accentColor}${i === 0 ? "33" : "1a"}, transparent 70%)`,
            }}
            animate={{
              x: [0, i % 2 === 0 ? 80 : -80, 0],
              y: [0, i === 1 ? 60 : -60, 0],
              opacity: [0.25 + energy * 0.3, 0.55 + energy * 0.35, 0.25 + energy * 0.3],
            }}
            transition={{
              duration: 14 + i * 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  if (preset === "glow") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          className="absolute left-1/2 top-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${accentColor}2e, transparent 65%)` }}
          animate={{
            scale: [1, 1.08 + energy * 0.12, 1],
            opacity: [0.35 + energy * 0.25, 0.55 + energy * 0.35, 0.35 + energy * 0.25],
          }}
          transition={{ duration: 5 - energy * 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {seeds.map((seed, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${seed.x}%`,
            top: `${seed.y}%`,
            width: seed.size,
            height: seed.size,
            background: accentColor,
            boxShadow: `0 0 ${6 + energy * 10}px ${accentColor}`,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.15 + energy * 0.55, 0],
            y: [0, -30 - energy * 20, 0],
          }}
          transition={{
            duration: seed.duration,
            delay: seed.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
