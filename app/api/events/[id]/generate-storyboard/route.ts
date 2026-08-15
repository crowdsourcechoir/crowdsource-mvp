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
import {
  buildStoryboardImagePrompt,
  buildStoryboardMotionPrompt,
} from "@/lib/song-garden-v2/storyboard-prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_FRAMES = 1;
const MAX_FRAMES = 6;
const DEFAULT_FRAMES = 1;
/** 10s loops feel continuous; 5s resets read as a glitch. */
const VIDEO_DURATION_SEC = 10;

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

  // Place-photo gens stay grounded in the landmark — don't world-lock to prior (often overcooked) frames.
  const { referenceImages, placeTags, siblingTags } = mergeStoryboardReferences({
    placeUris,
    siblingSceneUrls: placeUris.length > 0 ? [] : siblingSceneUrls,
    frameIndex,
    frameCount,
  });

  const runwayImageUrl = await generateImageFromText({
    promptText: buildStoryboardImagePrompt(vibePrompt, frameIndex, frameCount, {
      placeTags,
      siblingTags: placeUris.length > 0 ? [] : siblingTags,
    }),
    model: "gen4_image",
    ratio: "1920:1080",
    ...(referenceImages.length ? { referenceImages } : {}),
  });
  const sceneFilename = `${eventId}-scene-${frameIndex + 1}-${Date.now()}.jpg`;
  const sceneUrl = await persistGeneratedMedia(runwayImageUrl, sceneFilename, "image/jpeg");

  const runwayVideoUrl = await generateVideoFromImage({
    promptImage: sceneUrl,
    promptText: buildStoryboardMotionPrompt(vibePrompt, frameIndex, frameCount, { placeTags }),
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

  const existingSiblings = Array.isArray(body.siblingSceneUrls) ? body.siblingSceneUrls : [];
  const startIndex = existingSiblings.length;
  const newCount = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, body.frameCount || DEFAULT_FRAMES));
  const boardSpan = Math.max(startIndex + newCount, newCount);
  const frames: WorldStoryboardFrame[] = [];

  for (let i = 0; i < newCount; i += 1) {
    try {
      const frameIndex = startIndex + i;
      const siblingSceneUrls = [
        ...existingSiblings,
        ...frames.map((f) => f.sceneUrl ?? null),
      ];
      frames.push(
        await generateOneFrame({
          eventId,
          vibePrompt,
          frameIndex,
          frameCount: boardSpan,
          placeUris,
          siblingSceneUrls,
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
          framesRequested: newCount,
          appendedFrom: startIndex,
        },
        { status: code === "insufficient_credits" ? 402 : 502 }
      );
    }
  }

  return NextResponse.json({ frames, appendedFrom: startIndex });
}
