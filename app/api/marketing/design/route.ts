import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { getDefaultDesignSystem, updateDefaultDesignTokens } from "@/lib/marketing/db/design";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMarketingAuth(async () => {
    const design = await getDefaultDesignSystem();
    return NextResponse.json(design);
  });
}

export async function PATCH(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as { tokens?: unknown } | null;
    if (!body?.tokens || typeof body.tokens !== "object") {
      return NextResponse.json({ error: "tokens required" }, { status: 400 });
    }
    const design = await updateDefaultDesignTokens(body.tokens);
    return NextResponse.json(design);
  });
}
