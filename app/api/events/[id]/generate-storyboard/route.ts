import { NextResponse } from "next/server";
import {
  generateImageFromText,
  generateVideoFromImage,
  isRunwayConfigured,
  RunwayError,
} from "@/lib/song-garden-v2/runway";
import { persistGeneratedMedia } from "@/lib/song-garden-v2/persist-generated-media";
import type { WorldStoryboardFrame } from "@/lib/song-garden-v2/world-config";

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
const INTENSITY_MODIFIERS = [
  "quiet dormant desert dusk, soft sandstone dunes, faint Sphere glow on the horizon, sparse bioluminescent seeds barely lit, calm empty pathways",
  "early awakening, desert blooms beginning to open, soft cyan mycelial threads connecting a few glowing seeds, Sphere faintly pulsing in the distance",
  "living garden emerging, cacti and digital plants intertwined, warm gold and indigo light, mycelial network spreading, pathways starting to pulse",
  "full bloom regenerative ecosystem, radiant bioluminescent greens and electric cyan, Sphere reflecting community patterns, dense glowing seed network, optimistic cinematic energy",
];

const MAX_VIBE_PROMPT_CHARS = 480;
const IMAGE_SUFFIX =
  "Premium cinematic wide environment concept art, no people in foreground, no readable text or logos, desert sage sandstone warm gold copper deep indigo electric cyan soft violet bioluminescent green color palette.";
const MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light and haze, camera locked in place, seamless looping atmosphere, no people walking into frame, no text or logos.";

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
  hasReference: boolean
): string {
  const refHint = hasReference
    ? "Inspired by @ref — use it as place/atmosphere reference, invent a new Song Garden world rather than copying the photo literally."
    : "";
  return `${condenseVibePrompt(vibePrompt)}. ${intensityFor(frameIndex, frameCount)}. ${refHint} ${IMAGE_SUFFIX}`
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

function extensionForContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webm")) return "webm";
  return "mp4";
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

  let body: { vibePrompt?: string; frameCount?: number; imageDataUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const vibePrompt = body.vibePrompt?.trim();
  const referenceImage = body.imageDataUrl?.trim() || null;
  const frameCount = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, body.frameCount || DEFAULT_FRAMES));

  if (!vibePrompt) {
    return NextResponse.json(
      { error: "Describe the vibe (place, mood, community) so Runway can invent the world." },
      { status: 400 }
    );
  }

  const frames: WorldStoryboardFrame[] = [];

  for (let i = 0; i < frameCount; i += 1) {
    try {
      // 1) Invent a new still from the vibe (+ optional reference photo for place/atmosphere).
      const runwayImageUrl = await generateImageFromText({
        promptText: buildImagePrompt(vibePrompt, i, frameCount, Boolean(referenceImage)),
        model: "gen4_image",
        ratio: "1920:1080",
        ...(referenceImage
          ? { referenceImages: [{ uri: referenceImage, tag: "ref" }] }
          : {}),
      });
      const sceneFilename = `${eventId}-scene-${i + 1}-${Date.now()}.jpg`;
      const sceneUrl = await persistGeneratedMedia(runwayImageUrl, sceneFilename, "image/jpeg");

      // 2) Animate that still into a longer seamless-ish loop.
      const runwayVideoUrl = await generateVideoFromImage({
        promptImage: sceneUrl,
        promptText: buildMotionPrompt(vibePrompt, i, frameCount),
        model: "gen4_turbo",
        duration: VIDEO_DURATION_SEC,
        ratio: "1280:720",
      });
      const videoFilename = `${eventId}-frame-${i + 1}-${Date.now()}.mp4`;
      const videoUrl = await persistGeneratedMedia(runwayVideoUrl, videoFilename, "video/mp4");

      frames.push({
        sceneUrl,
        videoUrl,
        energy: frameCount > 1 ? i / (frameCount - 1) : 1,
      });
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
