import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { createSegment, deleteSegment, listSegmentsWithCounts, updateSegment } from "@/lib/marketing/db/segments";
import type { SegmentRule } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMarketingAuth(async () => {
    const segments = await listSegmentsWithCounts();
    return NextResponse.json({ segments });
  });
}

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const rules = Array.isArray(body.rules) ? (body.rules as SegmentRule[]) : [];
    const segment = await createSegment({
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      rules,
    });
    return NextResponse.json({ segment });
  });
}

export async function PATCH(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const segment = await updateSegment({
      id: body.id,
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" || body.description === null ? (body.description as string | null) : undefined,
      rules: Array.isArray(body.rules) ? (body.rules as SegmentRule[]) : undefined,
    });
    if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ segment });
  });
}

export async function DELETE(request: Request) {
  return withMarketingAuth(async () => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteSegment(id);
    return NextResponse.json({ ok: true });
  });
}
