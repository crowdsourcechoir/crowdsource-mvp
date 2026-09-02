import { NextResponse } from "next/server";
import { getGardenByIdOrSlug, updateGarden } from "@/lib/song-garden-v2/garden/store";
import {
  defaultAtmosphere,
  resolveAtmosphere,
} from "@/lib/song-garden-v2/garden/types";
import {
  generateImageFromText,
  generateVideoFromImage,
  isRunwayConfigured,
  RunwayError,
} from "@/lib/song-garden-v2/runway";
import { persistGeneratedMedia } from "@/lib/song-garden-v2/persist-generated-media";
import {
  buildStoryboardImagePrompt,
  buildStoryboardMotionPrompt,
  condenseVibePrompt,
} from "@/lib/song-garden-v2/storyboard-prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const VIDEO_DURATION_SEC = 10;

type Ctx = { params: Promise<{ id: string }> };

/**
 * In-editor vibe generate for Garden atmosphere (still + looping video).
 * Sets mode to vibe_video. Does not wipe map plate assets.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) {
    return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });
  }

  if (!isRunwayConfigured()) {
    return NextResponse.json(
      {
        error:
          "Runway is not configured. Add RUNWAYML_API_SECRET to env and restart.",
        code: "not_configured",
      },
      { status: 503, ...NO_STORE }
    );
  }

  try {
    let body: { vibePrompt?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const current = resolveAtmosphere(garden.brandKit);
    const vibePrompt = condenseVibePrompt(
      body.vibePrompt?.trim() ||
        current.vibePrompt ||
        garden.brandKit.mapPlate.vibePrompt ||
        garden.title
    );
    if (!vibePrompt.trim()) {
      return NextResponse.json(
        { error: "Add a vibe prompt first." },
        { status: 400, ...NO_STORE }
      );
    }

    const runwayImageUrl = await generateImageFromText({
      promptText: buildStoryboardImagePrompt(vibePrompt, 0, 1, {
        placeTags: [],
        siblingTags: [],
      }),
      model: "gen4_image",
      ratio: "1920:1080",
    });
    const sceneFilename = `${garden.id}-atm-scene-${Date.now()}.jpg`;
    const sceneUrl = await persistGeneratedMedia(runwayImageUrl, sceneFilename, "image/jpeg");

    const runwayVideoUrl = await generateVideoFromImage({
      promptImage: sceneUrl,
      promptText: buildStoryboardMotionPrompt(vibePrompt, 0, 1, { placeTags: [] }),
      model: "gen4_turbo",
      duration: VIDEO_DURATION_SEC,
      ratio: "1280:720",
    });
    const videoFilename = `${garden.id}-atm-loop-${Date.now()}.mp4`;
    const videoUrl = await persistGeneratedMedia(runwayVideoUrl, videoFilename, "video/mp4");

    const atmosphere = defaultAtmosphere({
      mode: "vibe_video",
      stillUrl: sceneUrl,
      posterUrl: sceneUrl,
      videoUrl,
      vibePrompt,
    });

    const updated = await updateGarden(garden.id, { brandKit: { atmosphere } });
    return NextResponse.json(
      { atmosphere, garden: updated, sceneUrl, videoUrl },
      NO_STORE
    );
  } catch (err) {
    if (err instanceof RunwayError) {
      const status =
        err.code === "not_configured"
          ? 503
          : err.code === "insufficient_credits"
            ? 402
            : err.code === "rate_limited"
              ? 429
              : 502;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status, ...NO_STORE }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate failed" },
      { status: 500, ...NO_STORE }
    );
  }
}
