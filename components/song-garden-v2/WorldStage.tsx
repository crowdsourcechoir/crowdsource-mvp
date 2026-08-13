"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  resolveStoryboardFrame,
  resolveStoryboardFrameAtIndex,
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

const STORYBOARD_CROSSFADE_SEC = 1.1;

/** Full opacity from step one — energy used to dim early frames and look muddy. */
const WORLD_MEDIA_OPACITY = 1;
const WORLD_MEDIA_FILTER = "saturate(1.12) brightness(1.12) contrast(1.04)";

type WorldStageProps = {
  world: WorldConfig;
  /** 0..1 — increases as the participant contributes; makes the world visibly livelier. */
  energyLevel: number;
  /**
   * When set, force this storyboard plate (prompt-tied background).
   * Null/undefined = bucket by energyLevel as usual.
   */
  storyboardFrameIndex?: number | null;
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
  storyboardFrameIndex = null,
  celebrationTrigger,
  soundtrackUnlocked,
  growthNodes,
  children,
}: WorldStageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const storyboardFrame = useMemo(() => {
    if (storyboardFrameIndex != null && Number.isFinite(storyboardFrameIndex)) {
      return resolveStoryboardFrameAtIndex(world, storyboardFrameIndex);
    }
    return resolveStoryboardFrame(world, energyLevel);
  }, [world, energyLevel, storyboardFrameIndex]);
  const blend = useMemo(
    () => (storyboardFrame ? null : resolveWorldSceneBlend(world, energyLevel)),
    [world, energyLevel, storyboardFrame]
  );
  const baseIntensity = storyboardFrame?.energy ?? energyLevel;
  // Strong enough to feel on phone tilt / mouse move — 16px was too subtle under the UI card.
  const tilt = useAmbientTilt(32);

  // Warm the browser cache so step changes don't flash empty media.
  useEffect(() => {
    const frames = world.worldStoryboard ?? [];
    const links: HTMLLinkElement[] = [];
    for (const frame of frames) {
      if (frame.sceneUrl) {
        const img = new Image();
        img.src = frame.sceneUrl;
      }
      if (frame.videoUrl && typeof document !== "undefined") {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "video";
        link.href = frame.videoUrl;
        document.head.appendChild(link);
        links.push(link);
      }
    }
    return () => {
      for (const link of links) link.remove();
    };
  }, [world.worldStoryboard]);

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
            <StoryboardBackground frame={storyboardFrame.frame} veilColor={world.primaryColor} />
          ) : blend ? (
            <>
              <motion.div
                key={`lower-${blend.lower.sceneUrl}`}
                className="absolute inset-0"
                initial={false}
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
                  initial={false}
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
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url('${world.heroArtworkUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: WORLD_MEDIA_FILTER,
                  opacity: WORLD_MEDIA_OPACITY,
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
  const key = `${frame.videoUrl || ""}|${frame.sceneUrl || ""}`;
  return key === "|" ? "empty" : key;
}

/**
 * Hold the current plate fully opaque until the next plate's still/video is
 * ready, then crossfade. Never reveals the solid brand wash between frames.
 */
function StoryboardBackground({
  frame,
  veilColor,
}: {
  frame: WorldStoryboardFrame;
  veilColor: string;
}) {
  const [displayed, setDisplayed] = useState(frame);
  const [incoming, setIncoming] = useState<WorldStoryboardFrame | null>(null);
  const [incomingVisible, setIncomingVisible] = useState(false);
  const swapTimerRef = useRef<number | null>(null);
  const incomingRef = useRef<WorldStoryboardFrame | null>(null);
  const targetKeyRef = useRef(storyboardMediaKey(frame));

  const displayedKey = storyboardMediaKey(displayed);
  const targetKey = storyboardMediaKey(frame);
  targetKeyRef.current = targetKey;
  incomingRef.current = incoming;

  useEffect(() => {
    if (targetKey === displayedKey) {
      if (incoming) {
        setIncoming(null);
        setIncomingVisible(false);
      }
      return;
    }
    if (incoming && storyboardMediaKey(incoming) === targetKey) return;
    setIncoming(frame);
    setIncomingVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to target/displayed identity
  }, [targetKey, displayedKey, frame]);

  useEffect(() => {
    return () => {
      if (swapTimerRef.current != null) window.clearTimeout(swapTimerRef.current);
    };
  }, []);

  const promoteIncoming = () => {
    const pending = incomingRef.current;
    if (!pending) return;
    if (storyboardMediaKey(pending) !== targetKeyRef.current) return;
    setIncomingVisible(true);
    if (swapTimerRef.current != null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setDisplayed(pending);
      setIncoming(null);
      setIncomingVisible(false);
      swapTimerRef.current = null;
    }, STORYBOARD_CROSSFADE_SEC * 1000);
  };

  return (
    <div className="absolute inset-0" aria-hidden>
      <StoryboardPlate frame={displayed} veilColor={veilColor} visible />
      {incoming ? (
        <StoryboardPlate
          key={storyboardMediaKey(incoming)}
          frame={incoming}
          veilColor={veilColor}
          visible={incomingVisible}
          onReady={promoteIncoming}
        />
      ) : null}
    </div>
  );
}

function StoryboardPlate({
  frame,
  veilColor,
  visible,
  onReady,
}: {
  frame: WorldStoryboardFrame;
  veilColor: string;
  visible: boolean;
  onReady?: () => void;
}) {
  const readySent = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    readySent.current = false;
  }, [frame.videoUrl, frame.sceneUrl]);

  useEffect(() => {
    if (!onReadyRef.current) return;
    if (frame.videoUrl) return; // LoopingVideo reports ready
    if (!frame.sceneUrl) {
      onReadyRef.current();
      return;
    }
    const img = new Image();
    const done = () => {
      if (readySent.current) return;
      readySent.current = true;
      onReadyRef.current?.();
    };
    img.onload = done;
    img.onerror = done;
    img.src = frame.sceneUrl;
    if (img.complete) done();
  }, [frame.sceneUrl, frame.videoUrl]);

  return (
    <motion.div
      className="absolute inset-0"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: STORYBOARD_CROSSFADE_SEC, ease: [0.22, 1, 0.36, 1] }}
    >
      {frame.videoUrl ? (
        <LoopingVideo
          src={frame.videoUrl}
          poster={frame.sceneUrl ?? undefined}
          veilColor={veilColor}
          onReady={onReady}
        />
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
  );
}
