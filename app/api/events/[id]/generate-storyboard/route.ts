import { NextResponse } from "next/server";
import {
  generateImageFromText,
  generateVideoFromImage,
  isRunwayConfigured,
  RunwayError,
} from "@/lib/song-garden-v2/runway";
import { persistGeneratedMedia } from "@/lib/song-garden-v2/persist-generated-media";
import type { WorldStoryboardFrame } from "@/lib/song-garden-v2/world-config";
import {
  mergeStoryboardReferences,
  normalizePlaceReferenceUris,
} from "@/lib/song-garden-v2/storyboard-refs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_FRAMES = 2;
const MAX_FRAMES = 6;
const DEFAULT_FRAMES = 4;
/** 10s loops feel continuous; 5s resets read as a glitch. */
const VIDEO_DURATION_SEC = 10;

/**
 * Escalating world states — each frame is a *new* still invented from the vibe,
 * not a recycled event photo. Intensity climbs so the garden visibly wakes up.
 */
/** Place-agnostic growth arc — vibe prompt carries location/palette specifics. */
const INTENSITY_MODIFIERS = [
  "quiet dormant threshold dusk, soft mist and empty pathways, sparse bioluminescent seeds barely lit, calm waiting atmosphere",
  "early awakening, organic forms beginning to open, soft mycelial threads connecting a few glowing seeds, light gently gathering",
  "living garden emerging, natural and luminous digital forms intertwined, warm light, mycelial network spreading, pathways starting to pulse",
  "full bloom regenerative ecosystem, radiant bioluminescent growth, dense glowing seed network of community contributions, optimistic cinematic energy",
];

const MAX_VIBE_PROMPT_CHARS = 480;
const IMAGE_SUFFIX =
  "Premium cinematic wide environment concept art, tack-sharp focus, high detail, crisp textures, no soft focus, no heavy fog or muddy blur, no people in foreground, no readable text or logos; follow the vibe prompt color palette.";
const MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light, camera locked in place, seamless looping atmosphere, keep the scene sharp and clear, no soft focus, no heavy haze or blur, no people walking into frame, no text or logos.";

function condenseVibePrompt(vibePrompt: string): string {
  const collapsed = vibePrompt.trim().replace(/\s+/g, " ");
  if (collapsed.length <= MAX_VIBE_PROMPT_CHARS) return collapsed;
  const cut = collapsed.slice(0, MAX_VIBE_PROMPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : MAX_VIBE_PROMPT_CHARS)}…`;
}

function intensityFor(frameIndex: number, frameCount: number): string {
  const t = frameCount > 1 ? frameIndex / (frameCount - 1) : 1;
  const idx = Math.min(
    INTENSITY_MODIFIERS.length - 1,
    Math.round(t * (INTENSITY_MODIFIERS.length - 1))
  );
  return INTENSITY_MODIFIERS[idx];
}

function buildImagePrompt(
  vibePrompt: string,
  frameIndex: number,
  frameCount: number,
  opts: { placeTags?: string[]; siblingTags?: string[] } = {}
): string {
  const { placeTags = [], siblingTags = [] } = opts;
  const continuityParts: string[] = [];
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
  const continuity = continuityParts.join(" ");
  return `${condenseVibePrompt(vibePrompt)}. ${intensityFor(frameIndex, frameCount)}. ${continuity} ${IMAGE_SUFFIX}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function buildMotionPrompt(vibePrompt: string, frameIndex: number, frameCount: number): string {
  return `${condenseVibePrompt(vibePrompt)}. ${intensityFor(frameIndex, frameCount)}. ${MOTION_SUFFIX}`.slice(
    0,
    1000
  );
}

async function generateOneFrame(opts: {
  eventId: string;
  vibePrompt: string;
  frameIndex: number;
  frameCount: number;
  placeUris: string[];
  /** Other frames' still URLs (index-aligned; holes/nulls allowed). Used for theme continuity. */
  siblingSceneUrls?: Array<string | null | undefined>;
}): Promise<WorldStoryboardFrame> {
  const { eventId, vibePrompt, frameIndex, frameCount, placeUris, siblingSceneUrls } = opts;

  const { referenceImages, placeTags, siblingTags } = mergeStoryboardReferences({
    placeUris,
    siblingSceneUrls,
    frameIndex,
    frameCount,
  });

  const runwayImageUrl = await generateImageFromText({
    promptText: buildImagePrompt(vibePrompt, frameIndex, frameCount, {
      placeTags,
      siblingTags,
    }),
    model: "gen4_image",
    ratio: "1920:1080",
    ...(referenceImages.length ? { referenceImages } : {}),
  });
  const sceneFilename = `${eventId}-scene-${frameIndex + 1}-${Date.now()}.jpg`;
  const sceneUrl = await persistGeneratedMedia(runwayImageUrl, sceneFilename, "image/jpeg");

  const runwayVideoUrl = await generateVideoFromImage({
    promptImage: sceneUrl,
    promptText: buildMotionPrompt(vibePrompt, frameIndex, frameCount),
    model: "gen4_turbo",
    duration: VIDEO_DURATION_SEC,
    ratio: "1280:720",
  });
  const videoFilename = `${eventId}-frame-${frameIndex + 1}-${Date.now()}.mp4`;
  const videoUrl = await persistGeneratedMedia(runwayVideoUrl, videoFilename, "video/mp4");

  return {
    sceneUrl,
    videoUrl,
    energy: frameCount > 1 ? frameIndex / (frameCount - 1) : 1,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  if (!isRunwayConfigured()) {
    return NextResponse.json(
      {
        error: "Runway is not configured. Add RUNWAYML_API_SECRET to .env.local and restart the dev server.",
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  let body: {
    vibePrompt?: string;
    frameCount?: number;
    /** @deprecated Prefer referenceUrls / imageDataUrls */
    imageDataUrl?: string;
    imageDataUrls?: string[];
    /** Preferred: public storage URLs (or data URIs) for place/atmosphere refs. */
    referenceUrls?: string[];
    /** When set, regenerate only this 0-based frame and leave the rest alone. */
    frameIndex?: number;
    /** Index-aligned still URLs for the current board — other frames guide theme continuity. */
    siblingSceneUrls?: Array<string | null | undefined>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const vibePrompt = body.vibePrompt?.trim();
  const placeUris = normalizePlaceReferenceUris(body);

  if (!vibePrompt) {
    return NextResponse.json(
      { error: "Describe the vibe (place, mood, community) so Runway can invent the world." },
      { status: 400 }
    );
  }

  const singleFrameIndex =
    typeof body.frameIndex === "number" && Number.isFinite(body.frameIndex)
      ? Math.floor(body.frameIndex)
      : null;

  // Single-frame replace — intensity uses the board length you already have.
  if (singleFrameIndex != null) {
    if (singleFrameIndex < 0 || singleFrameIndex >= MAX_FRAMES) {
      return NextResponse.json(
        { error: `frameIndex must be between 0 and ${MAX_FRAMES - 1}.` },
        { status: 400 }
      );
    }
    const siblingSceneUrls = Array.isArray(body.siblingSceneUrls) ? body.siblingSceneUrls : [];
    const frameCount = Math.max(
      singleFrameIndex + 1,
      siblingSceneUrls.length,
      Math.min(MAX_FRAMES, body.frameCount || DEFAULT_FRAMES)
    );

    try {
      const frame = await generateOneFrame({
        eventId,
        vibePrompt,
        frameIndex: singleFrameIndex,
        frameCount,
        placeUris,
        siblingSceneUrls,
      });
      return NextResponse.json({ frame, frameIndex: singleFrameIndex, frames: [frame] });
    } catch (err) {
      const code = err instanceof RunwayError ? err.code : "api_error";
      const message = err instanceof Error ? err.message : "Failed to regenerate this frame.";
      return NextResponse.json(
        { error: message, code },
        { status: code === "insufficient_credits" ? 402 : 502 }
      );
    }
  }

  const frameCount = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, body.frameCount || DEFAULT_FRAMES));
  const frames: WorldStoryboardFrame[] = [];

  for (let i = 0; i < frameCount; i += 1) {
    try {
      frames.push(
        await generateOneFrame({
          eventId,
          vibePrompt,
          frameIndex: i,
          frameCount,
          placeUris,
        })
      );
    } catch (err) {
      const code = err instanceof RunwayError ? err.code : "api_error";
      const message = err instanceof Error ? err.message : "Failed to generate this frame.";
      return NextResponse.json(
        {
          error: message,
          code,
          frames,
          framesCompleted: frames.length,
          framesRequested: frameCount,
        },
        { status: code === "insufficient_credits" ? 402 : 502 }
      );
    }
  }

  return NextResponse.json({ frames });
}
