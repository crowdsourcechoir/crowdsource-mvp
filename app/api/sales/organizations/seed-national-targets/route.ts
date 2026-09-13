import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { publicErrorMessage } from "@/lib/sales/http-error";
import { seedNationalKeynoteTargets } from "@/lib/sales/prospecting/seed-national-targets";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Seed curated national / hall-scale keynote targets and run the pipeline (Hunter enrich).
 * Body: { runPipeline?: boolean, limit?: number }
 */
export async function POST(request: Request) {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Database not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      runPipeline?: boolean;
      limit?: number;
      offset?: number;
    };
    const result = await seedNationalKeynoteTargets({
      runPipeline: body.runPipeline !== false,
      limit: typeof body.limit === "number" ? body.limit : undefined,
      offset: typeof body.offset === "number" ? body.offset : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to seed national targets") }, { status: 500 });
  }
}
