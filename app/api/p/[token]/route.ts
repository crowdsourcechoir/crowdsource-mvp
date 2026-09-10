import { NextResponse } from "next/server";
import { getPitchByToken, pitchShareUrl, ensureSlidesUrl, markPitchShared } from "@/lib/sales/pitches/service";

export const dynamic = "force-dynamic";

/** Public pitch metadata for the /p/[token] page (no admin auth). */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const pitch = await getPitchByToken(token);
  if (!pitch || pitch.status === "archived") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Soft mark as shared when prospect opens the link.
  if (pitch.status !== "shared") {
    await markPitchShared(pitch.id).catch(() => null);
  }
  const ready = ensureSlidesUrl(pitch);
  return NextResponse.json({
    title: ready.title,
    organizationName: ready.organizationName,
    googleSlidesUrl: ready.googleSlidesUrl,
    hasPdf: Boolean(ready.pdfStoragePath),
    shareUrl: pitchShareUrl(ready),
  });
}
