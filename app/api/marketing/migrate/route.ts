import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { migrateJsonMarketingStore } from "@/lib/marketing/migrate-json-store";

export const dynamic = "force-dynamic";

/** One-shot copy of marketing/v1.json into Postgres. Idempotent. */
export async function POST() {
  return withMarketingAuth(async () => {
    const result = await migrateJsonMarketingStore();
    return NextResponse.json(result);
  });
}
