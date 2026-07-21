"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { WorldConfig } from "@/lib/song-garden-v2/world-config";
import ParticleField from "./ParticleField";

type WorldStageProps = {
  world: WorldConfig;
  /** 0..1 — increases as the participant contributes; makes the world visibly livelier. */
  energyLevel: number;
  /** Bump this (e.g. Date.now()) to fire a one-off "world reacts" pulse. */
  celebrationTrigger: number;
  /** True once a user gesture has happened, so the ambient soundtrack is allowed to play. */
  soundtrackUnlocked: boolean;
  children: React.ReactNode;
};

/**
 * The persistent world. Never unmounts between journey phases — only the
 * MomentOverlay content on top of it changes. This is what replaces traditional
 * page transitions: the world stays, the interaction changes.
 */
export default function WorldStage({
  world,
  energyLevel,
  celebrationTrigger,
  soundtrackUnlocked,
  children,
}: WorldStageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !world.ambientSoundtrackUrl) return;
    if (soundtrackUnlocked) {
      el.volume = 0.35;
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [soundtrackUnlocked, world.ambientSoundtrackUrl]);

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden [color-scheme:dark]"
      style={{
        background: `radial-gradient(120% 90% at 50% -10%, ${world.accentColor}1f, ${world.primaryColor} 55%)`,
      }}
    >
      {world.heroArtworkUrl && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 + energyLevel * 0.1 }}
          transition={{ duration: 1.4 }}
          style={{
            backgroundImage: `url('${world.heroArtworkUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(6px) saturate(0.9)",
          }}
          aria-hidden
        />
      )}

      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, transparent 0%, ${world.primaryColor}cc 75%)` }}
        aria-hidden
      />

      <ParticleField preset={world.animationPreset} accentColor={world.accentColor} energy={energyLevel} />

      {celebrationTrigger > 0 && (
        <motion.div
          key={celebrationTrigger}
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 62%, ${world.accentColor}55, transparent 60%)`,
          }}
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          aria-hidden
        />
      )}

      {world.ambientSoundtrackUrl && (
        <audio ref={audioRef} src={world.ambientSoundtrackUrl} loop preload="none" />
      )}

      <div className="relative z-10 flex min-h-[100dvh] flex-col">{children}</div>
    </div>
  );
}
