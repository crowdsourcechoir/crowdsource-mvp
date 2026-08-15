/**
 * Prompt builders for Runway storyboard stills + motion.
 * Kept out of the route so smoke tests can import without Next request context.
 */

export type StoryboardBoardMode = "journey" | "landmarks";

const JOURNEY_INTENSITY = [
  "quiet dormant threshold dusk, soft mist and empty pathways, sparse bioluminescent seeds barely lit, calm waiting atmosphere",
  "early awakening, organic forms beginning to open, soft mycelial threads connecting a few glowing seeds, light gently gathering",
  "living garden emerging, natural and luminous digital forms intertwined, warm light, mycelial network spreading, pathways starting to pulse",
  "full bloom regenerative ecosystem, radiant bioluminescent growth, dense glowing seed network of community contributions, optimistic cinematic energy",
];

const LANDMARK_LIGHT = [
  "quiet dusk light, soft atmosphere, gentle ambient glow beginning",
  "early evening light gathering, warm accents starting to wake",
  "living light in the scene, soft luminous accents, hopeful energy",
  "radiant evening presence, warm glow, optimistic cinematic energy — still the same real place",
];

export const MAX_VIBE_PROMPT_CHARS = 480;

const JOURNEY_IMAGE_SUFFIX =
  "Premium cinematic wide environment concept art, tack-sharp focus, high detail, crisp textures, no soft focus, no heavy fog or muddy blur, no people in foreground, no readable text or logos; follow the vibe prompt color palette.";
const LANDMARK_IMAGE_SUFFIX =
  "Photoreal cinematic still of this real place, tack-sharp, natural materials and proportions, restrained enhancement only — soft luminous Song Garden light and atmosphere, not a surreal AI collage or invented architecture; no people in foreground, no readable text or logos.";
export const STORYBOARD_MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light, gentle atmospheric movement, camera locked in place, seamless looping atmosphere, keep the scene sharp and clear, no soft focus, no heavy haze or blur, no people walking into frame, no text or logos.";

export function condenseVibePrompt(vibePrompt: string): string {
  const collapsed = vibePrompt.trim().replace(/\s+/g, " ");
  if (collapsed.length <= MAX_VIBE_PROMPT_CHARS) return collapsed;
  const cut = collapsed.slice(0, MAX_VIBE_PROMPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : MAX_VIBE_PROMPT_CHARS)}…`;
}

export function parseBoardMode(raw: unknown): StoryboardBoardMode {
  return raw === "landmarks" ? "landmarks" : "journey";
}

function intensityFor(
  mode: StoryboardBoardMode,
  frameIndex: number,
  frameCount: number
): string {
  const ladder = mode === "landmarks" ? LANDMARK_LIGHT : JOURNEY_INTENSITY;
  // Landmarks are built one place at a time — step the light ladder by frame order,
  // not by "how many frames exist so far" (which would jump dusk → full bloom on frame 2).
  const idx =
    mode === "landmarks"
      ? Math.min(ladder.length - 1, Math.max(0, frameIndex))
      : (() => {
          const t = frameCount > 1 ? frameIndex / (frameCount - 1) : 0;
          return Math.min(ladder.length - 1, Math.round(t * (ladder.length - 1)));
        })();
  return ladder[idx];
}

export function buildStoryboardImagePrompt(
  vibePrompt: string,
  frameIndex: number,
  frameCount: number,
  mode: StoryboardBoardMode,
  opts: { placeTags?: string[]; siblingTags?: string[] } = {}
): string {
  const { placeTags = [], siblingTags = [] } = opts;
  const continuityParts: string[] = [];

  if (mode === "landmarks") {
    if (placeTags.length > 0) {
      const placeList = placeTags.map((t) => `@${t}`).join(", ");
      continuityParts.push(
        `Ground this frame in ${placeList} — keep the real landmark architecture, skyline, and place identity recognizable. Enhance with soft Song Garden light, gentle luminous life, and atmosphere only. Do not invent a different building, do not collage multiple places, do not over-stylize into surreal AI concept art.`
      );
    } else {
      continuityParts.push(
        "One clear real-world landmark scene, restrained cinematic enhancement with soft light only — not an overcooked AI fantasy world."
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
    if (placeTags.length > 0) {
      const placeList = placeTags.map((t) => `@${t}`).join(", ");
      continuityParts.push(
        siblingTags.length > 0
          ? `Also take place/atmosphere cues from ${placeList} without copying them literally.`
          : `Inspired by ${placeList} — use ${
              placeTags.length === 1 ? "it" : "them"
            } as place/atmosphere reference${placeTags.length === 1 ? "" : "s"}, invent a new Song Garden world rather than copying the photo${
              placeTags.length === 1 ? "" : "s"
            } literally.`
      );
    }
  }

  const continuity = continuityParts.join(" ");
  const suffix = mode === "landmarks" ? LANDMARK_IMAGE_SUFFIX : JOURNEY_IMAGE_SUFFIX;
  const vibe = condenseVibePrompt(vibePrompt).replace(/[.…]+$/, "");
  return `${vibe}. ${intensityFor(mode, frameIndex, frameCount)}. ${continuity} ${suffix}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

export function buildStoryboardMotionPrompt(
  vibePrompt: string,
  frameIndex: number,
  frameCount: number,
  mode: StoryboardBoardMode
): string {
  const vibe = condenseVibePrompt(vibePrompt).replace(/[.…]+$/, "");
  return `${vibe}. ${intensityFor(mode, frameIndex, frameCount)}. ${STORYBOARD_MOTION_SUFFIX}`.slice(
    0,
    1000
  );
}
