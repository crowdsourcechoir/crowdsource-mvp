import { NextResponse } from "next/server";
import { runPipelineForOrganization } from "@/lib/sales/pipeline/run-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.organizationId || typeof body.organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }
    const summary = await runPipelineForOrganization(body.organizationId);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
