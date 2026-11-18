import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  getFigmaConfig2027Status,
  seedFigmaConfig2027,
} from "@/lib/sales/seed/figma-config-2027";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Idempotent seed of Figma Config 2027 (May 25–27, 2027 at Pier 80, San Francisco)
 * with Hunter-verified Experiential Marketing & Events contacts.
 *
 * GET ?status=1 — public progress check (contact names + statuses, no email addresses).
 * GET/POST with Bearer CRON_SECRET — execute seed.
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
      return NextResponse.json(await getFigmaConfig2027Status());
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
      force = new URL(request.url).searchParams.get("force") === "1";
    }

    const result = await seedFigmaConfig2027({ force });
    return NextResponse.json({
      ok: result.error === null,
      done: result.error === null && (result.enqueued || result.alreadySeeded),
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
