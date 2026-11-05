import { NextResponse } from "next/server";
import { assignHomeCities } from "@/lib/marketing/db/home-cities";
import { MarketingDbError } from "@/lib/marketing/db/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One-shot: label the Mailchimp audience Seattle, Spokane, or Boise and save those segments. */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await assignHomeCities();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MarketingDbError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
