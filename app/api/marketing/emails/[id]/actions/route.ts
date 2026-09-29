import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { getEmailForPreview } from "@/lib/marketing/db/campaigns";
import { getMarketingSettings } from "@/lib/marketing/db/settings";
import { renderMarketingEmail } from "@/lib/marketing/email/render";
import { resolveEventBlocks } from "@/lib/marketing/email/send";
import { siteUrl } from "@/lib/site-url";
import { startListSend } from "@/lib/marketing/send/queue";
import { sendTestEmail } from "@/lib/marketing/send/test-send";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const action = typeof body?.action === "string" ? body.action : "preview";

    if (action === "test") {
      const to = typeof body?.to === "string" ? body.to : "";
      const result = await sendTestEmail({ sendId: id, to });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ providerMessageId: result.providerMessageId });
    }

    if (action === "send") {
      const confirmPhrase = typeof body?.confirmPhrase === "string" ? body.confirmPhrase : "";
      const result = await startListSend({ sendId: id, confirmPhrase });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({
        queued: result.queued,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        remaining: result.remaining,
      });
    }

    if (action !== "preview") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const email = await getEmailForPreview(id);
    if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = await getMarketingSettings();
    const origin = siteUrl();
    const eventsByBlockId = await resolveEventBlocks(email, origin);
    const rendered = renderMarketingEmail(email, {
      settings,
      unsubscribeUrl: `${origin}/api/marketing/unsubscribe?preview=test`,
      baseUrl: origin,
      eventsByBlockId,
    });
    return NextResponse.json(rendered);
  });
}
