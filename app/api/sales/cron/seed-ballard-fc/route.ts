import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { syncGmailReplies } from "@/lib/sales/gmail/sync";
import {
  getBallardFcSeedStatus,
  seedBallardFcConversation,
} from "@/lib/sales/seed/ballard-fc-conversation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-shot Ballard FC seed: sports org + Sam thread at Interest, follow-up Nov 12.
 *
 * GET ?status=1 — public progress (no emails).
 * GET/POST with Bearer CRON_SECRET — run seed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    try {
      requireSupabaseAdmin();
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Database not configured." },
        { status: 503 }
      );
    }
    try {
      const status = await getBallardFcSeedStatus();
      return NextResponse.json(status);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Server error" },
        { status: 500 }
      );
    }
  }
  return runSeed(request);
}

export async function POST(request: Request) {
  return runSeed(request);
}

async function runSeed(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database not configured." },
      { status: 503 }
    );
  }

  try {
    let force = false;
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { force?: boolean };
      force = Boolean(body.force);
    } else {
      force = url.searchParams.get("force") === "1";
    }

    const result = await seedBallardFcConversation({ force });

    let gmailSync: unknown = null;
    try {
      gmailSync = await syncGmailReplies();
    } catch (err) {
      gmailSync = { error: err instanceof Error ? err.message : "Gmail sync failed" };
    }

    const status = await getBallardFcSeedStatus();
    return NextResponse.json({
      ok: true,
      done: status.done,
      result,
      gmailSync,
      status,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
