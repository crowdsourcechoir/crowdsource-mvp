import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { listEventsForMarketingPicker } from "@/lib/marketing/events-readonly";

export const dynamic = "force-dynamic";

/** READ-ONLY bloom list for the email composer event block. */
export async function GET() {
  return withMarketingAuth(async () => {
    const events = await listEventsForMarketingPicker();
    return NextResponse.json({ events });
  });
}
