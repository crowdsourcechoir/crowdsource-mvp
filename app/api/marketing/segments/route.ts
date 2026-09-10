import { NextResponse } from "next/server";
import { newId } from "@/lib/marketing/ids";
import { countSegment } from "@/lib/marketing/segments";
import { readMarketingStore, updateMarketingStore } from "@/lib/marketing/store";
import type { SegmentRule } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { store } = await readMarketingStore();
  const segments = store.segments.map((segment) => ({
    ...segment,
    counts: {
      matched: countSegment(store.people, segment),
      sendable: countSegment(store.people, segment, { sendableOnly: true }),
    },
  }));
  return NextResponse.json({ segments });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const rules = Array.isArray(body.rules) ? (body.rules as SegmentRule[]) : [];
  const now = new Date().toISOString();
  const segment = {
    id: newId("seg"),
    name: body.name.trim(),
    description: typeof body.description === "string" ? body.description : null,
    rules,
    createdAt: now,
    updatedAt: now,
  };
  await updateMarketingStore((store) => {
    store.segments.unshift(segment);
  });
  return NextResponse.json({ segment });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  let updated = null as ReturnType<typeof Object> | null;
  const { error } = await updateMarketingStore((store) => {
    const segment = store.segments.find((s) => s.id === body.id);
    if (!segment) return;
    if (typeof body.name === "string") segment.name = body.name.trim();
    if (typeof body.description === "string" || body.description === null) {
      segment.description = body.description as string | null;
    }
    if (Array.isArray(body.rules)) segment.rules = body.rules as SegmentRule[];
    segment.updatedAt = new Date().toISOString();
    updated = segment;
  });
  if (error) return NextResponse.json({ error }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ segment: updated });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await updateMarketingStore((store) => {
    store.segments = store.segments.filter((s) => s.id !== id);
  });
  return NextResponse.json({ ok: true });
}
