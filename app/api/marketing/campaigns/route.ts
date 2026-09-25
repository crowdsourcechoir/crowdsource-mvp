import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { createCampaign, listCampaignsWithEmails } from "@/lib/marketing/db/campaigns";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMarketingAuth(async () => {
    const payload = await listCampaignsWithEmails();
    return NextResponse.json(payload);
  });
}

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const created = await createCampaign({
      name: body.name,
      purpose: typeof body.purpose === "string" ? body.purpose : null,
      subject: typeof body.subject === "string" ? body.subject : undefined,
      previewText: typeof body.previewText === "string" ? body.previewText : undefined,
    });
    return NextResponse.json(created);
  });
}
