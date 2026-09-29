import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { cancelSend } from "@/lib/marketing/send/queue";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const result = await cancelSend(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  });
}
