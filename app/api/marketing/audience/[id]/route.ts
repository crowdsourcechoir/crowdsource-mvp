import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { getPerson } from "@/lib/marketing/db/people";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const person = await getPerson(id);
    if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ person });
  });
}
