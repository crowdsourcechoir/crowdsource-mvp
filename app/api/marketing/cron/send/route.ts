import { NextResponse } from "next/server";
import { MarketingDbError } from "@/lib/marketing/db/errors";
import { promoteDueSends } from "@/lib/marketing/send/queue";
import { listSendingIds, resetStaleClaims, runSendWorker } from "@/lib/marketing/send/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reset = await resetStaleClaims();
    const promoted = await promoteDueSends();
    const requested = new URL(request.url).searchParams.get("sendId");
    const ids = requested ? [requested] : await listSendingIds();
    const sends = [];
    for (const id of ids) {
      sends.push({ id, ...(await runSendWorker(id, { budgetMs: 200_000, chain: false })) });
    }
    return NextResponse.json({ reset, promoted, sends });
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
