"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  resolveStoryboardFrame,
  resolveWorldSceneBlend,
  type WorldConfig,
} from "@/lib/song-garden-v2/world-config";
import type { WorldGrowthNode } from "@/lib/song-garden-v2/growth-nodes";
import { useAmbientTilt } from "@/lib/song-garden-v2/tilt";
import LoopingVideo from "./LoopingVideo";
import ParticleField from "./ParticleField";
import WorldEnergyField from "./WorldEnergyField";
import WorldGrowthLayer from "./WorldGrowthLayer";

type WorldStageProps = {
  world: WorldConfig;
  /** 0..1 — increases as the participant contributes; makes the world visibly livelier. */
  energyLevel: number;
  /** Bump this (e.g. Date.now()) to fire a one-off "world reacts" pulse. */
  celebrationTrigger: number;
  /** True once a user gesture has happened, so the ambient soundtrack is allowed to play. */
  soundtrackUnlocked: boolean;
  /** Everything this participant has contributed so far — rendered as a persistent, growing garden. */
  growthNodes: WorldGrowthNode[];
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
  growthNodes,
  children,
}: WorldStageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const storyboardFrame = useMemo(() => resolveStoryboardFrame(world, energyLevel), [world, energyLevel]);
  const blend = useMemo(
    () => (storyboardFrame ? null : resolveWorldSceneBlend(world, energyLevel)),
    [world, energyLevel, storyboardFrame]
  );
  const baseOpacity = 0.4 + energyLevel * 0.18;
  const baseIntensity = storyboardFrame?.energy ?? energyLevel;
  // Strong enough to feel on phone tilt / mouse move — 16px was too subtle under the UI card.
  const tilt = useAmbientTilt(32);

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
      className="relative h-[100dvh] overflow-hidden [color-scheme:dark]"
      style={{
        background: `radial-gradient(120% 90% at 50% -10%, ${world.accentColor}1f, ${world.primaryColor} 55%)`,
      }}
    >
      {/* Oversized + tilt-shifted so the 2.5D drift never reveals an edge. */}
      <motion.div className="absolute -inset-[8%]" style={{ x: tilt.x, y: tilt.y }}>
        {storyboardFrame ? (
          <StoryboardBackground frame={storyboardFrame.frame} opacity={baseOpacity} />
        ) : blend ? (
          <>
            {/* Lower (earlier) stage — fades out as `t` climbs toward the next stage. Kept
                mounted (never removed) so every step nudges opacity gradually instead of a
                hard swap at one threshold. */}
            <motion.div
              key={`lower-${blend.lower.sceneUrl}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: baseOpacity * (1 - blend.t) }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              style={{
                backgroundImage: `url('${blend.lower.sceneUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "saturate(1.05)",
              }}
              aria-hidden
            />
            {blend.upper && (
              <motion.div
                key={`upper-${blend.upper.sceneUrl}`}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: baseOpacity * blend.t }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                style={{
                  backgroundImage: `url('${blend.upper.sceneUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "saturate(1.05)",
                }}
                aria-hidden
              />
            )}
          </>
        ) : (
          world.heroArtworkUrl && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: baseOpacity }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              style={{
                backgroundImage: `url('${world.heroArtworkUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "saturate(1.05)",
              }}
              aria-hidden
            />
          )
        )}
      </motion.div>

      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, transparent 0%, ${world.primaryColor}cc 75%)` }}
        aria-hidden
      />

      <ParticleField preset={world.animationPreset} accentColor={world.accentColor} energy={baseIntensity} />

      <WorldEnergyField accentColor={world.accentColor} baseIntensity={baseIntensity} pulseTrigger={celebrationTrigger} />

      <WorldGrowthLayer nodes={growthNodes} accentColor={world.accentColor} />

      {world.ambientSoundtrackUrl && (
        <audio ref={audioRef} src={world.ambientSoundtrackUrl} loop preload="none" />
      )}

      <div className="relative z-10 flex h-full flex-col overflow-y-auto">{children}</div>
    </div>
  );
}

function StoryboardBackground({
  frame,
  opacity,
}: {
  frame: { sceneUrl: string | null; videoUrl: string | null };
  opacity: number;
}) {
  if (frame.videoUrl) {
    return (
      <motion.div
        key={frame.videoUrl}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      >
        <LoopingVideo src={frame.videoUrl} poster={frame.sceneUrl ?? undefined} opacity={opacity} />
      </motion.div>
    );
  }
  if (frame.sceneUrl) {
    return (
      <motion.div
        key={frame.sceneUrl}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        style={{
          backgroundImage: `url('${frame.sceneUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(1.05)",
        }}
        aria-hidden
      />
    );
  }
  return null;
}
