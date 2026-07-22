import { NextResponse } from "next/server";
import { runPipelineBatch } from "@/lib/sales/pipeline/run-pipeline-batch";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

/** Manual trigger — lets you test the overnight batch behavior today, before any cron fires. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : undefined;
    const summary = await runPipelineBatch(limit);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
