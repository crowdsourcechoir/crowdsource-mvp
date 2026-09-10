import { NextResponse } from "next/server";
import { sendMarketingEmailNow, sendMarketingTestEmail } from "@/lib/marketing/email/send";
import { resolveEventBlocks } from "@/lib/marketing/email/send";
import { renderMarketingEmail } from "@/lib/marketing/email/render";
import { readMarketingStore } from "@/lib/marketing/store";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "https://app.crowdsourcechoir.com";
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "preview";

  if (action === "preview") {
    const { store } = await readMarketingStore();
    const email = store.emails.find((e) => e.id === id);
    if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const origin = baseUrl();
    const eventsByBlockId = await resolveEventBlocks(email, origin);
    const rendered = renderMarketingEmail(email, {
      settings: store.settings,
      unsubscribeUrl: `${origin}/api/marketing/unsubscribe?email=preview@example.com`,
      baseUrl: origin,
      eventsByBlockId,
    });
    return NextResponse.json(rendered);
  }

  if (action === "test") {
    const to = typeof body?.to === "string" ? body.to : "";
    if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });
    const result = await sendMarketingTestEmail({ emailId: id, to });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "send") {
    const confirmPhrase = typeof body?.confirmPhrase === "string" ? body.confirmPhrase : "";
    const result = await sendMarketingEmailNow({ emailId: id, confirmPhrase });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
