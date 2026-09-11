import { NextResponse } from "next/server";
import { newId } from "@/lib/marketing/ids";
import { defaultEmailBlocks } from "@/lib/marketing/email/render";
import { readMarketingStore, updateMarketingStore } from "@/lib/marketing/store";
import { EMPTY_EMAIL_STATS } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { store } = await readMarketingStore();
  return NextResponse.json({
    campaigns: store.campaigns,
    emails: store.emails,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const { store } = await readMarketingStore();
  const campaign = {
    id: newId("cmp"),
    name: body.name.trim(),
    purpose: typeof body.purpose === "string" ? body.purpose : null,
    status: "draft" as const,
    createdAt: now,
    updatedAt: now,
  };
  const email = {
    id: newId("eml"),
    campaignId: campaign.id,
    subject: typeof body.subject === "string" ? body.subject : "Crowdsource Choir",
    previewText: typeof body.previewText === "string" ? body.previewText : "",
    fromName: store.settings.fromName,
    fromEmail: store.settings.fromEmail,
    replyTo: store.settings.replyTo,
    blocks: defaultEmailBlocks(store.settings),
    segmentId: null,
    status: "draft" as const,
    scheduledFor: null,
    sentAt: null,
    stats: { ...EMPTY_EMAIL_STATS },
    createdAt: now,
    updatedAt: now,
  };
  const { error } = await updateMarketingStore((s) => {
    s.campaigns.unshift(campaign);
    s.emails.unshift(email);
  });
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ campaign, email });
}
