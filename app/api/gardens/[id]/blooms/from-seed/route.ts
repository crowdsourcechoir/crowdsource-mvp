import { NextResponse } from "next/server";
import { getGardenByIdOrSlug, listChapters, addChapter, updateGarden } from "@/lib/song-garden-v2/garden/store";
import { resolveAtmosphere } from "@/lib/song-garden-v2/garden/types";
import {
  getContributionNode,
  markContributionSelected,
  upsertContributionNode,
} from "@/lib/platform-v2/store";
import { defaultJourneySteps } from "@/lib/songgarden/journey-steps";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const USE_LOCAL = () => process.env.USE_LOCAL_EVENTS === "true";

type Ctx = { params: Promise<{ id: string }> };

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "bloom";
}

/**
 * Grow a Bloom (event + journey) from a Garden seed/contribution.
 * Attaches as the next chapter and features the seed in Culture.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) {
    return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });
  }

  try {
    const body = (await request.json()) as {
      sourceType?: "clip" | "turn" | "pulse";
      sourceId?: string;
      title?: string;
      excerpt?: string;
      creditName?: string;
      attachChapter?: boolean;
      evergreen?: boolean;
    };

    const sourceType = body.sourceType;
    const sourceId = body.sourceId?.trim();
    if (!sourceType || !sourceId) {
      return NextResponse.json(
        { error: "sourceType and sourceId required" },
        { status: 400, ...NO_STORE }
      );
    }

    let node = await getContributionNode(garden.id, sourceType, sourceId);
    if (!node) {
      node = await upsertContributionNode({
        gardenId: garden.id,
        sourceType,
        sourceId,
        kind: "other",
        creditName: body.creditName ?? null,
        excerpt: body.excerpt ?? null,
      });
    }

    if (node.bloomEventId) {
      return NextResponse.json(
        {
          error: "This seed already grew a Bloom.",
          bloomEventId: node.bloomEventId,
        },
        { status: 409, ...NO_STORE }
      );
    }

    const title =
      (body.title?.trim() ||
        node.excerpt?.trim() ||
        (node.creditName ? `Bloom from ${node.creditName}` : null) ||
        `${garden.title} Bloom`)
        .slice(0, 80);
    const excerpt = body.excerpt?.trim() || node.excerpt?.trim() || "";
    const atm = resolveAtmosphere(garden.brandKit);
    const vibe =
      atm.vibePrompt?.trim() ||
      garden.brandKit.mapPlate.vibePrompt?.trim() ||
      excerpt ||
      garden.title;

    const slugBase = slugify(`${garden.slug}-${title}`);
    const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`;

    const journeySteps = defaultJourneySteps();
    // Seed the first text prompt from the contribution when present.
    const textStep = journeySteps.find((s) => s.kind === "prompt");
    if (textStep && textStep.kind === "prompt" && excerpt) {
      textStep.prompt = `Grow from this seed: “${excerpt.slice(0, 120)}” — what do you add next?`;
    }

    const songGardenConfig = {
      soundTransitionMessage: "",
      steps: [],
      journeySteps,
      welcomeEyebrow: garden.brandKit.presenceEyebrow || garden.brandKit.title || garden.title,
    };

    const worldConfig = {
      title,
      heroArtworkUrl: atm.stillUrl || garden.brandKit.heroArtworkUrl,
      logoUrl: garden.brandKit.logoUrl,
      primaryColor: garden.brandKit.primaryColor,
      accentColor: garden.brandKit.accentColor,
      animationPreset: garden.brandKit.animationPreset,
      ambientSoundtrackUrl: garden.brandKit.ambientSoundtrackUrl,
      aiArtworkPrompt: vibe,
      worldSceneStages: [],
      worldStoryboard:
        atm.mode === "vibe_video" && atm.videoUrl
          ? [
              {
                sceneUrl: atm.posterUrl || atm.stillUrl,
                videoUrl: atm.videoUrl,
                energy: 0,
              },
            ]
          : [],
      presenceSimulationEnabled: true,
    };

    const createPayload = {
      slug,
      title,
      description: excerpt || `Grown from a seed in ${garden.title}`,
      date: new Date().toISOString().slice(0, 10),
      time: "",
      venue: garden.title,
      address: "",
      prompt: excerpt,
      landingHeadline: title,
      landingCopy: excerpt
        ? `This Bloom grew from a seed in ${garden.title}: “${excerpt}”`
        : `A living journey grown from ${garden.title}.`,
      ctaText: "Enter the Bloom",
      songGardenConfig,
      journeySteps,
      worldConfig,
    };

    const origin = new URL(request.url).origin;
    const createRes = await fetch(`${origin}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      return NextResponse.json(
        { error: created.error || "Could not create Bloom" },
        { status: createRes.status, ...NO_STORE }
      );
    }

    const bloomEventId = String(created.id);
    const chapters = await listChapters(garden.id);
    const nextIndex =
      chapters.reduce((max, c) => Math.max(max, c.index), 0) + 1;
    const attach = body.attachChapter !== false;
    let chapter = null;
    if (attach) {
      chapter = await addChapter({
        gardenId: garden.id,
        eventId: bloomEventId,
        index: nextIndex,
        label: title.slice(0, 48),
        status: body.evergreen === false ? "open" : "open",
      });
    }

    // Link seed → bloom and feature it.
    await upsertContributionNode({
      gardenId: garden.id,
      sourceType,
      sourceId,
      kind: node.kind,
      creditName: node.creditName,
      excerpt: node.excerpt,
      bloomEventId,
      chapterId: chapter?.id ?? null,
    });
    await markContributionSelected({
      gardenId: garden.id,
      sourceType,
      sourceId,
      selected: true,
    });

    // Ensure brandKit presence defaults stay coherent (no-op if already set).
    if (!garden.brandKit.presenceEyebrow) {
      await updateGarden(garden.id, {
        brandKit: { presenceEyebrow: garden.brandKit.title },
      });
    }

    return NextResponse.json(
      {
        bloom: {
          id: bloomEventId,
          slug: created.slug,
          title: created.title,
          publicPath: `/e/${created.slug}`,
          adminPath: `/admin/events/${bloomEventId}`,
        },
        chapter,
        local: USE_LOCAL(),
      },
      { status: 201, ...NO_STORE }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grow Bloom failed" },
      { status: 500, ...NO_STORE }
    );
  }
}
