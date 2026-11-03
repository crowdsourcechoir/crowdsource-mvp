import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  drainAnthemPricing,
  evaluateAnthemPricing,
  getAnthemPricingStatus,
} from "@/lib/sales/pricing/evaluate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function cronBaseUrl(request: Request): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

/**
 * Batch Anthem Experience fee recommendations onto opportunities.import_metadata.
 * Never overwrites bookedAmount / potentialAmount.
 *
 * GET ?status=1 — progress summary (no secret).
 * GET/POST with Bearer CRON_SECRET — drain unevaluated rows for ~4 minutes, then chain.
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
      const status = await getAnthemPricingStatus();
      return NextResponse.json(status);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Server error" },
        { status: 500 }
      );
    }
  }
  return runEvaluate(request);
}

export async function POST(request: Request) {
  return runEvaluate(request);
}

async function runEvaluate(request: Request) {
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
    const url = new URL(request.url);
    let force = url.searchParams.get("force") === "1";
    let offset = Number(url.searchParams.get("offset") ?? "0") || 0;
    let limit = Number(url.searchParams.get("limit") ?? "100") || 100;
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        force?: boolean;
        offset?: number;
        limit?: number;
      };
      if (body.force != null) force = Boolean(body.force);
      if (body.offset != null) offset = Number(body.offset) || 0;
      if (body.limit != null) limit = Number(body.limit) || 100;
    }

    // Forced re-page keeps the old single-batch path; normal cron drains hard.
    if (force) {
      const result = await evaluateAnthemPricing({ force, offset, limit });
      return NextResponse.json({
        ok: result.summary.errors.length === 0,
        mode: "force-page",
        ...result,
      });
    }

    const drained = await drainAnthemPricing({ limit, budgetMs: 250_000 });
    const continueDepth = Number(url.searchParams.get("continue") ?? "0") || 0;

    if (!drained.exhausted && continueDepth < 30) {
      const next = new URL("/api/sales/cron/anthem-pricing", cronBaseUrl(request));
      next.searchParams.set("continue", String(continueDepth + 1));
      const secret = cronSecret;
      const run = async () => {
        try {
          await fetch(next.toString(), {
            method: "GET",
            headers: { Authorization: `Bearer ${secret}` },
          }).then((r) => r.text());
        } catch (err) {
          console.error("[anthem-pricing] continuation failed:", err);
        }
      };
      try {
        waitUntil(run());
      } catch {
        void run();
      }
    }

    return NextResponse.json({
      ok: drained.errors === 0,
      mode: "drain",
      continueDepth,
      ...drained,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
