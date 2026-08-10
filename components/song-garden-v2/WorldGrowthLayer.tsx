"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { growthNodePosition, type WorldGrowthNode } from "@/lib/song-garden-v2/growth-nodes";

type WorldGrowthLayerProps = {
  nodes: WorldGrowthNode[];
  accentColor: string;
};

const KIND_SHAPE: Record<WorldGrowthNode["kind"], { radius: string; size: number; glow: number }> = {
  text: { radius: "30%", size: 9, glow: 8 },
  voice: { radius: "50%", size: 12, glow: 14 },
  video: { radius: "18%", size: 14, glow: 10 },
  percussion: { radius: "6%", size: 10, glow: 16 },
  vocal: { radius: "50%", size: 15, glow: 18 },
  other: { radius: "38%", size: 11, glow: 10 },
};

/** Deterministic 0..1 "random" per node so drift is stable across re-renders instead of jittering. */
function pseudoRandom(seed: number, salt: number): number {
  const v = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * The persistent record of everything this participant has contributed. Unlike
 * CelebrationBurst (which fades in ~900ms), every node placed here stays for the
 * rest of the session and drifts gently — like the ambient particle field — so the
 * world reads as continuously alive rather than a static trophy shelf. Positions
 * follow a phyllotaxis (sunflower-seed) spiral so growth reads as organic.
 *
 * Each node keeps a stable `key` for its whole lifetime, so its "grow in" entrance
 * (`initial` → first frame of `animate`) plays exactly once, the moment it mounts —
 * no separate "fresh" tracking needed. After that it settles into the same
 * floating/pulsing loop as every other node.
 */
export default function WorldGrowthLayer({ nodes, accentColor }: WorldGrowthLayerProps) {
  const placed = useMemo(
    () => nodes.map((node) => ({ node, pos: growthNodePosition(node.index) })),
    [nodes]
  );

  if (!placed.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {placed.map(({ node, pos }) => {
        const shape = KIND_SHAPE[node.kind];
        const shared = node.emphasis === "shared";
        const size = shared ? Math.max(6, shape.size - 2) : shape.size;
        const glow = shared ? Math.max(4, shape.glow - 6) : shape.glow;
        const opacityLoop = shared ? ([0.22, 0.38, 0.22] as const) : ([0.55, 0.85, 0.55] as const);
        const floatX = (pseudoRandom(node.index, 5) - 0.5) * 2 * (10 + size);
        const floatY = (pseudoRandom(node.index, 6) - 0.5) * 2 * 16;
        const floatDuration = 6 + pseudoRandom(node.index, 7) * 6;
        const pulseDuration = 5 + (node.index % 6);
        return (
          <motion.span
            key={node.id}
            className="absolute"
            style={{
              left: `${pos.xPct}%`,
              top: `${pos.yPct}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: shape.radius,
              background: accentColor,
              boxShadow: `0 0 ${glow}px ${accentColor}`,
            }}
            initial={{ scale: 0, opacity: 0, x: 0, y: 40 }}
            animate={{
              scale: shared ? [1, 1.08, 1] : [1, 1.18, 1],
              opacity: [...opacityLoop],
              x: [0, floatX, 0],
              y: [0, floatY, 0],
            }}
            transition={{
              scale: { duration: pulseDuration, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: pulseDuration, repeat: Infinity, ease: "easeInOut" },
              x: { duration: floatDuration, repeat: Infinity, ease: "easeInOut" },
              y: { duration: floatDuration, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        );
      })}
    </div>
  );
}
