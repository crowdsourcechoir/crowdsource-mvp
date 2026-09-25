import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { getEmailForPreview } from "@/lib/marketing/db/campaigns";
import { getMarketingSettings } from "@/lib/marketing/db/settings";
import { renderMarketingEmail } from "@/lib/marketing/email/render";
import { resolveEventBlocks } from "@/lib/marketing/email/send";

export const dynamic = "force-dynamic";

const SEND_PAUSED = "Sending moves to the queue in a later phase. Nothing was mailed.";

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "https://app.crowdsourcechoir.com";
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const action = typeof body?.action === "string" ? body.action : "preview";

    if (action === "test" || action === "send") {
      return NextResponse.json({ error: SEND_PAUSED }, { status: 409 });
    }

    if (action !== "preview") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const email = await getEmailForPreview(id);
    if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = await getMarketingSettings();
    const origin = baseUrl();
    const eventsByBlockId = await resolveEventBlocks(email, origin);
    const rendered = renderMarketingEmail(email, {
      settings,
      unsubscribeUrl: `${origin}/api/marketing/unsubscribe?email=preview@example.com`,
      baseUrl: origin,
      eventsByBlockId,
    });
    return NextResponse.json(rendered);
  });
}
