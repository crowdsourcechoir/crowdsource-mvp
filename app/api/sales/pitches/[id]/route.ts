import { NextResponse } from "next/server";
import { attachPitchLinkToQueueDraft } from "@/lib/sales/pitches/attach";
import {
  ensureSlidesUrl,
  exportPitchPdf,
  getPitchById,
  pitchShareUrl,
  refillPitchPlaceholders,
  updatePitch,
} from "@/lib/sales/pitches/service";
import type { PitchStatus } from "@/lib/sales/pitches/types";
import { supabaseAdmin } from "@/lib/supabase-server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const download = new URL(request.url).searchParams.get("download");
  const pitch = await getPitchById(id);
  if (!pitch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (download === "pdf") {
    if (!pitch.pdfStoragePath) {
      return NextResponse.json({ error: "No PDF exported yet." }, { status: 404 });
    }
    if (supabaseAdmin) {
      const bucket = process.env.SUPABASE_MEDIA_BUCKET || "agent-media";
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(pitch.pdfStoragePath);
      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "Download failed" }, { status: 500 });
      }
      const buf = Buffer.from(await data.arrayBuffer());
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pitch.id}.pdf"`,
        },
      });
    }
    const local = join(process.cwd(), ".data", "pitch-pdfs", `${pitch.id}.pdf`);
    if (!existsSync(local)) return NextResponse.json({ error: "PDF file missing" }, { status: 404 });
    return new NextResponse(readFileSync(local), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pitch.id}.pdf"`,
      },
    });
  }

  return NextResponse.json({
    pitch: { ...ensureSlidesUrl(pitch), shareUrl: pitchShareUrl(pitch) },
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const action = typeof body.action === "string" ? body.action : "update";

    if (action === "refill") {
      const pitch = await refillPitchPlaceholders(id);
      return NextResponse.json({ pitch: { ...ensureSlidesUrl(pitch), shareUrl: pitchShareUrl(pitch) } });
    }

    if (action === "attach-draft") {
      const pitch = await getPitchById(id);
      if (!pitch) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const result = await attachPitchLinkToQueueDraft(pitch);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      const updated = await getPitchById(id);
      return NextResponse.json({
        ...result,
        pitch: updated ? { ...ensureSlidesUrl(updated), shareUrl: pitchShareUrl(updated) } : null,
      });
    }

    if (action === "export-pdf") {
      const pitch = await exportPitchPdf(id);
      return NextResponse.json({ pitch: { ...ensureSlidesUrl(pitch), shareUrl: pitchShareUrl(pitch) } });
    }

    const pitch = await updatePitch(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      status: typeof body.status === "string" ? (body.status as PitchStatus) : undefined,
      promptText: typeof body.promptText === "string" || body.promptText === null ? (body.promptText as string | null) : undefined,
      googleSlidesUrl:
        typeof body.googleSlidesUrl === "string" || body.googleSlidesUrl === null
          ? (body.googleSlidesUrl as string | null)
          : undefined,
      googlePresentationId:
        typeof body.googlePresentationId === "string" || body.googlePresentationId === null
          ? (body.googlePresentationId as string | null)
          : undefined,
    });
    return NextResponse.json({ pitch: { ...ensureSlidesUrl(pitch), shareUrl: pitchShareUrl(pitch) } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
