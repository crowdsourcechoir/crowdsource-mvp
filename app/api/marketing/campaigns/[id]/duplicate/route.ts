import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { duplicateCampaign } from "@/lib/marketing/db/campaigns";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const name = body && typeof body.name === "string" ? body.name : undefined;
    const created = await duplicateCampaign(id, name);
    if (!created) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(created);
  });
}
