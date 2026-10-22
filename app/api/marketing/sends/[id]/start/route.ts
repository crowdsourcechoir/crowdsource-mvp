import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { startListSend } from "@/lib/marketing/send/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as { confirmPhrase?: string } | null;
    const result = await startListSend({ sendId: id, confirmPhrase: body?.confirmPhrase ?? "" });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  });
}
