import { NextResponse } from "next/server";
import { readMarketingStore, updateMarketingStore } from "@/lib/marketing/store";
import type { CampaignStatus, EmailBlock } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { store } = await readMarketingStore();
  const campaign = store.campaigns.find((c) => c.id === id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const emails = store.emails.filter((e) => e.campaignId === id);
  return NextResponse.json({ campaign, emails, segments: store.segments, settings: store.settings });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let found = false;
  const { error } = await updateMarketingStore((store) => {
    const campaign = store.campaigns.find((c) => c.id === id);
    if (!campaign) return;
    found = true;
    if (typeof body.name === "string") campaign.name = body.name.trim();
    if (typeof body.purpose === "string" || body.purpose === null) campaign.purpose = body.purpose as string | null;
    if (typeof body.status === "string") campaign.status = body.status as CampaignStatus;
    campaign.updatedAt = new Date().toISOString();

    if (typeof body.emailId === "string") {
      const email = store.emails.find((e) => e.id === body.emailId && e.campaignId === id);
      if (email) {
        if (typeof body.subject === "string") email.subject = body.subject;
        if (typeof body.previewText === "string") email.previewText = body.previewText;
        if (typeof body.fromName === "string") email.fromName = body.fromName;
        if (typeof body.fromEmail === "string") email.fromEmail = body.fromEmail;
        if (typeof body.replyTo === "string" || body.replyTo === null) email.replyTo = body.replyTo as string | null;
        if (typeof body.segmentId === "string" || body.segmentId === null) {
          email.segmentId = body.segmentId as string | null;
        }
        if (Array.isArray(body.blocks)) email.blocks = body.blocks as EmailBlock[];
        email.updatedAt = new Date().toISOString();
      }
    }
  });
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error) return NextResponse.json({ error }, { status: 500 });
  const { store } = await readMarketingStore();
  return NextResponse.json({
    campaign: store.campaigns.find((c) => c.id === id),
    emails: store.emails.filter((e) => e.campaignId === id),
  });
}
