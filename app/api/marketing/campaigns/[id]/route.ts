import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { getCampaignBundle, updateCampaign } from "@/lib/marketing/db/campaigns";
import { listSegments } from "@/lib/marketing/db/segments";
import { getMarketingSettings } from "@/lib/marketing/db/settings";
import type { EmailBlock } from "@/lib/marketing/types";
import type { EmailSection } from "@/lib/marketing/document/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const bundle = await getCampaignBundle(id);
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [segments, settings] = await Promise.all([listSegments(), getMarketingSettings()]);
    return NextResponse.json({ ...bundle, segments, settings });
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const updated = await updateCampaign({
      id,
      name: typeof body.name === "string" ? body.name : undefined,
      purpose: typeof body.purpose === "string" || body.purpose === null ? (body.purpose as string | null) : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      emailId: typeof body.emailId === "string" ? body.emailId : undefined,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      previewText: typeof body.previewText === "string" ? body.previewText : undefined,
      fromName: typeof body.fromName === "string" ? body.fromName : undefined,
      fromEmail: typeof body.fromEmail === "string" ? body.fromEmail : undefined,
      replyTo: typeof body.replyTo === "string" || body.replyTo === null ? (body.replyTo as string | null) : undefined,
      segmentId: typeof body.segmentId === "string" || body.segmentId === null ? (body.segmentId as string | null) : undefined,
      blocks: Array.isArray(body.blocks) ? (body.blocks as EmailBlock[]) : undefined,
      sections: Array.isArray(body.sections) ? (body.sections as EmailSection[]) : undefined,
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  });
}
