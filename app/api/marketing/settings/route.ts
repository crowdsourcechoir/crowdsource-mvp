import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { audienceTotals } from "@/lib/marketing/db/people";
import { listCampaignsWithEmails } from "@/lib/marketing/db/campaigns";
import { getMarketingSettings, updateMarketingSettings } from "@/lib/marketing/db/settings";
import type { MarketingSettings } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMarketingAuth(async () => {
    const [settings, totals, campaigns] = await Promise.all([
      getMarketingSettings(),
      audienceTotals(),
      listCampaignsWithEmails(),
    ]);
    return NextResponse.json({
      settings,
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      envSendsEnabled: process.env.MARKETING_SENDS_ENABLED !== "false",
      error: null,
      totals: {
        people: totals.all,
        subscribed: totals.subscribed,
        campaigns: campaigns.campaigns.length,
        emailsSent: campaigns.emails.filter((email) => email.status === "sent").length,
      },
    });
  });
}

export async function PATCH(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Partial<MarketingSettings> | null;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const settings = await updateMarketingSettings(body);
    return NextResponse.json({ settings });
  });
}
