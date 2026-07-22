import { NextResponse } from "next/server";
import { generateVideoFromImage, isRunwayConfigured, RunwayError } from "@/lib/song-garden-v2/runway";
import { persistGeneratedMedia } from "@/lib/song-garden-v2/persist-generated-media";
import type { WorldStoryboardFrame } from "@/lib/song-garden-v2/world-config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_FRAMES = 2;
const MAX_FRAMES = 8;
const DEFAULT_FRAMES = 6;

/**
 * One base photo (venue / city / org), animated at escalating "aliveness" so the same place
 * visibly wakes up across the storyboard — dormant/still at frame 1, full of light and motion
 * by the last frame. Kept generic on purpose (works for any event without per-venue authoring).
 */
const INTENSITY_MODIFIERS = [
  "quiet, still, dim ambient light, barely any movement, calm and dormant atmosphere",
  "faint signs of life, a few soft lights beginning to flicker on, very subtle drifting motion",
  "gentle movement, more lights glowing, soft ambient particles beginning to drift through the air",
  "noticeably more energy, warm light pulsing, particles and haze drifting, a sense of things awakening",
  "vibrant and glowing, dynamic light movement, particles swirling, lively and energetic atmosphere",
  "radiant and alive, bright pulsing light, motion everywhere, full bloom celebratory energy",
];

function buildPrompt(vibePrompt: string, frameIndex: number, frameCount: number): string {
  const t = frameCount > 1 ? frameIndex / (frameCount - 1) : 1;
  const modifierIndex = Math.min(
    INTENSITY_MODIFIERS.length - 1,
    Math.round(t * (INTENSITY_MODIFIERS.length - 1))
  );
  const modifier = INTENSITY_MODIFIERS[modifierIndex];
  return `${vibePrompt.trim()}. ${modifier}. Subtle ambient motion only, camera locked in place, seamless loop, no people walking into frame, no text or logos.`;
}

function extensionForContentType(contentType: string): string {
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

  let body: { imageDataUrl?: string; vibePrompt?: string; frameCount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const imageDataUrl = body.imageDataUrl?.trim();
  const vibePrompt = body.vibePrompt?.trim();
  const frameCount = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, body.frameCount || DEFAULT_FRAMES));

  if (!imageDataUrl) {
    return NextResponse.json({ error: "A source photo is required." }, { status: 400 });
  }
  if (!vibePrompt) {
    return NextResponse.json(
      { error: "Describe the vibe (venue, city, org, mood) so Runway knows what to animate." },
      { status: 400 }
    );
  }

  const frames: WorldStoryboardFrame[] = [];

  for (let i = 0; i < frameCount; i += 1) {
    const promptText = buildPrompt(vibePrompt, i, frameCount);
    try {
      const runwayUrl = await generateVideoFromImage({
        promptImage: imageDataUrl,
        promptText,
        model: "gen4_turbo",
        duration: 5,
        ratio: "1280:720",
      });
      const contentType = "video/mp4";
      const filename = `${eventId}-frame-${i + 1}-${Date.now()}.${extensionForContentType(contentType)}`;
      const persistedUrl = await persistGeneratedMedia(runwayUrl, filename, contentType);
      frames.push({
        sceneUrl: null,
        videoUrl: persistedUrl,
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
