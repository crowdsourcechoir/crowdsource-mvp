"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  resolveStoryboardFrame,
  resolveWorldSceneBlend,
  type WorldConfig,
  type WorldStoryboardFrame,
} from "@/lib/song-garden-v2/world-config";
import type { WorldGrowthNode } from "@/lib/song-garden-v2/growth-nodes";
import { useAmbientTilt } from "@/lib/song-garden-v2/tilt";
import LoopingVideo from "./LoopingVideo";
import ParticleField from "./ParticleField";
import WorldEnergyField from "./WorldEnergyField";
import WorldGrowthLayer from "./WorldGrowthLayer";

const STORYBOARD_CROSSFADE_SEC = 1.85;

/** Full opacity from step one — energy used to dim early frames and look muddy. */
const WORLD_MEDIA_OPACITY = 1;
const WORLD_MEDIA_FILTER = "saturate(1.12) brightness(1.12) contrast(1.04)";

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
      className="relative min-h-[100dvh] [color-scheme:dark]"
      style={{ background: world.primaryColor }}
    >
      {/*
        Fixed full-bleed world: covers the largest viewport (lvh) so iOS toolbars
        never leave a primary-color strip. Content scrolls over it.
      */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{
          minHeight: "100lvh",
          background: `radial-gradient(120% 90% at 50% -10%, ${world.accentColor}1f, ${world.primaryColor} 55%)`,
        }}
        aria-hidden
      >
        <motion.div className="absolute -inset-[10%]" style={{ x: tilt.x, y: tilt.y }}>
          {storyboardFrame ? (
            <StoryboardBackground frame={storyboardFrame.frame} />
          ) : blend ? (
            <>
              <motion.div
                key={`lower-${blend.lower.sceneUrl}`}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: WORLD_MEDIA_OPACITY * (1 - blend.t) }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                style={{
                  backgroundImage: `url('${blend.lower.sceneUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: WORLD_MEDIA_FILTER,
                }}
              />
              {blend.upper && (
                <motion.div
                  key={`upper-${blend.upper.sceneUrl}`}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: WORLD_MEDIA_OPACITY * blend.t }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  style={{
                    backgroundImage: `url('${blend.upper.sceneUrl}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: WORLD_MEDIA_FILTER,
                  }}
                />
              )}
            </>
          ) : (
            world.heroArtworkUrl && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: WORLD_MEDIA_OPACITY }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                style={{
                  backgroundImage: `url('${world.heroArtworkUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: WORLD_MEDIA_FILTER,
                }}
              />
            )
          )}
        </motion.div>

        {/* Soft vignette only — no heavy bottom wash that reads as a cut-off bar. */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${world.primaryColor}22 0%, transparent 28%, transparent 72%, ${world.primaryColor}28 100%)`,
          }}
        />

        <ParticleField preset={world.animationPreset} accentColor={world.accentColor} energy={baseIntensity} />
        <WorldEnergyField accentColor={world.accentColor} baseIntensity={baseIntensity} pulseTrigger={celebrationTrigger} />
        <WorldGrowthLayer nodes={growthNodes} accentColor={world.accentColor} />
      </div>

      {world.ambientSoundtrackUrl && (
        <audio ref={audioRef} src={world.ambientSoundtrackUrl} loop preload="none" />
      )}

      <div className="relative z-10 flex min-h-[100dvh] flex-col pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}

function storyboardMediaKey(frame: WorldStoryboardFrame): string {
  return frame.videoUrl || frame.sceneUrl || "empty";
}

/**
 * Crossfade between storyboard frames (one media layer each). No still stacked
 * under the playing video — that double-exposed trees/objects over themselves.
 */
function StoryboardBackground({ frame }: { frame: WorldStoryboardFrame }) {
  const mediaKey = storyboardMediaKey(frame);

  return (
    <div className="absolute inset-0" aria-hidden>
      <AnimatePresence initial={false}>
        <motion.div
          key={mediaKey}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: STORYBOARD_CROSSFADE_SEC, ease: [0.22, 1, 0.36, 1] }}
        >
          {frame.videoUrl ? (
            <LoopingVideo src={frame.videoUrl} poster={frame.sceneUrl ?? undefined} />
          ) : frame.sceneUrl ? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${frame.sceneUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: WORLD_MEDIA_FILTER,
              }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
