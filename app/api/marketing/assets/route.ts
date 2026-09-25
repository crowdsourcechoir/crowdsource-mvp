import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { listEmailAssets } from "@/lib/marketing/db/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMarketingAuth(async () => {
    const assets = await listEmailAssets();
    return NextResponse.json({ assets });
  });
}
