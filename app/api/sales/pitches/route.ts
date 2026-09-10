import { NextResponse } from "next/server";
import {
  createPitch,
  listPitchesForOpportunity,
  listPitchTemplates,
  upsertPitchTemplate,
  updatePitchSettings,
} from "@/lib/sales/pitches/service";
import { pitchShareUrl, ensureSlidesUrl } from "@/lib/sales/pitches/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunityId");
    if (opportunityId) {
      const pitches = (await listPitchesForOpportunity(opportunityId)).map((p) => ({
        ...ensureSlidesUrl(p),
        shareUrl: pitchShareUrl(p),
      }));
      return NextResponse.json({ pitches }, { headers: { "Cache-Control": "no-store" } });
    }
    const templates = await listPitchTemplates();
    return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const action = typeof body.action === "string" ? body.action : "create";

    if (action === "template") {
      if (typeof body.name !== "string" || typeof body.googleSlidesTemplateFileId !== "string") {
        return NextResponse.json(
          { error: "name and googleSlidesTemplateFileId are required" },
          { status: 400 }
        );
      }
      const template = await upsertPitchTemplate({
        id: typeof body.id === "string" ? body.id : undefined,
        name: body.name,
        description: typeof body.description === "string" ? body.description : null,
        googleSlidesTemplateFileId: body.googleSlidesTemplateFileId,
      });
      if (body.setDefault === true) {
        await updatePitchSettings({ defaultTemplateFileId: template.googleSlidesTemplateFileId });
      }
      return NextResponse.json({ template });
    }

    if (action === "settings") {
      await updatePitchSettings({
        defaultTemplateFileId:
          typeof body.defaultTemplateFileId === "string" ? body.defaultTemplateFileId : null,
      });
      return NextResponse.json({ ok: true });
    }

    if (typeof body.opportunityId !== "string") {
      return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
    }

    const pitch = await createPitch({
      opportunityId: body.opportunityId,
      title: typeof body.title === "string" ? body.title : undefined,
      promptText: typeof body.promptText === "string" ? body.promptText : null,
      templateId: typeof body.templateId === "string" ? body.templateId : null,
      googleSlidesUrl: typeof body.googleSlidesUrl === "string" ? body.googleSlidesUrl : null,
      googlePresentationId: typeof body.googlePresentationId === "string" ? body.googlePresentationId : null,
    });

    return NextResponse.json({
      pitch: { ...ensureSlidesUrl(pitch), shareUrl: pitchShareUrl(pitch) },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
