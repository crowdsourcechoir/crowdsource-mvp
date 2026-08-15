/**
 * Prompt builders for Runway storyboard stills + motion.
 * Place-ref gens stay photoreal; invent-world gens keep the growth arc.
 */

export const MAX_VIBE_PROMPT_CHARS = 480;

/** Invented Song Garden arc (no place photo). */
const JOURNEY_INTENSITY = [
  "quiet dormant threshold dusk, soft mist and empty pathways, sparse bioluminescent seeds barely lit, calm waiting atmosphere",
  "early awakening, organic forms beginning to open, soft mycelial threads connecting a few glowing seeds, light gently gathering",
  "living garden emerging, natural and luminous digital forms intertwined, warm light, mycelial network spreading, pathways starting to pulse",
  "full bloom regenerative ecosystem, radiant bioluminescent growth, dense glowing seed network of community contributions, optimistic cinematic energy",
];

/** Soft light ladder for real landmark photos — atmosphere only, no fantasy overlays. */
const LANDMARK_LIGHT = [
  "quiet dusk, natural twilight, restrained cinematic grade",
  "early evening light gathering, warm window glow, soft sky color",
  "richer evening light, gentle warmth on stone and brick, hopeful calm",
  "radiant evening presence, warm natural glow, optimistic cinematic realism — still the same real place",
];

const JOURNEY_IMAGE_SUFFIX =
  "Premium cinematic wide environment concept art, tack-sharp focus, high detail, crisp textures, no soft focus, no heavy fog or muddy blur, no people in foreground, no readable text or logos; follow the vibe prompt color palette.";

const LANDMARK_IMAGE_SUFFIX =
  "Photoreal cinematic photograph of this real place, tack-sharp, natural materials and proportions. Enhance lighting and atmosphere only. Strictly forbid: glowing vines, neon mycelium, floating orbs, bioluminescent seed networks, surreal light sculptures, fantasy overlays on architecture, AI collage. No people in foreground, no readable text or logos.";

const JOURNEY_MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light, camera locked in place, seamless looping atmosphere, keep the scene sharp and clear, no soft focus, no heavy haze or blur, no people walking into frame, no text or logos.";

const LANDMARK_MOTION_SUFFIX =
  "Subtle natural ambient motion only: soft sky/cloud drift, gentle light shift, faint water or leaf movement if present. Camera locked. Do not morph architecture. Do not invent or animate glowing vines, orbs, particles, or neon overlays. Seamless loop, sharp and clear, no people walking into frame, no text or logos.";

export function condenseVibePrompt(vibePrompt: string): string {
  const collapsed = vibePrompt.trim().replace(/\s+/g, " ");
  if (collapsed.length <= MAX_VIBE_PROMPT_CHARS) return collapsed;
  const cut = collapsed.slice(0, MAX_VIBE_PROMPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : MAX_VIBE_PROMPT_CHARS)}…`;
}

function stripTrailingPunct(s: string): string {
  return s.replace(/[.…]+$/, "");
}

function intensityFor(frameIndex: number, frameCount: number, landmark: boolean): string {
  const ladder = landmark ? LANDMARK_LIGHT : JOURNEY_INTENSITY;
  if (landmark) {
    return ladder[Math.min(ladder.length - 1, Math.max(0, frameIndex))];
  }
  const t = frameCount > 1 ? frameIndex / (frameCount - 1) : 0;
  const idx = Math.min(ladder.length - 1, Math.round(t * (ladder.length - 1)));
  return ladder[idx];
}

export function buildStoryboardImagePrompt(
  vibePrompt: string,
  frameIndex: number,
  frameCount: number,
  opts: { placeTags?: string[]; siblingTags?: string[] } = {}
): string {
  const { placeTags = [], siblingTags = [] } = opts;
  const landmark = placeTags.length > 0;
  const continuityParts: string[] = [];

  if (landmark) {
    const placeList = placeTags.map((t) => `@${t}`).join(", ");
    continuityParts.push(
      `Ground this frame in ${placeList} — keep the real landmark architecture, skyline, and place identity recognizable. Soft cinematic light and atmosphere only. Do not invent glowing plant networks, particle trees, or surreal overlays. Do not collage multiple places.`
    );
    if (siblingTags.length > 0) {
      continuityParts.push(
        `Match the restrained lighting language of ${siblingTags.map((t) => `@${t}`).join(", ")} without copying them literally.`
      );
    }
  } else {
    if (siblingTags.length > 0) {
      continuityParts.push(
        `Same continuous Song Garden world as ${siblingTags
          .map((t) => `@${t}`)
          .join(
            ", "
          )} — match their color palette, materials, architecture, lighting language, and visual identity. Invent a new growth-stage still in that world (do not copy any reference literally).`
      );
    }
  }

  const vibe = stripTrailingPunct(condenseVibePrompt(vibePrompt));
  const suffix = landmark ? LANDMARK_IMAGE_SUFFIX : JOURNEY_IMAGE_SUFFIX;
  return `${vibe}. ${intensityFor(frameIndex, frameCount, landmark)}. ${continuityParts.join(" ")} ${suffix}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

export function buildStoryboardMotionPrompt(
  vibePrompt: string,
  frameIndex: number,
  frameCount: number,
  opts: { placeTags?: string[] } = {}
): string {
  const landmark = (opts.placeTags?.length ?? 0) > 0;
  const vibe = stripTrailingPunct(condenseVibePrompt(vibePrompt));
  const suffix = landmark ? LANDMARK_MOTION_SUFFIX : JOURNEY_MOTION_SUFFIX;
  return `${vibe}. ${intensityFor(frameIndex, frameCount, landmark)}. ${suffix}`.slice(0, 1000);
}
