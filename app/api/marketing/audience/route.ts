import { NextResponse } from "next/server";
import { getMarketingPerson, listMarketingPeople, upsertMarketingPerson } from "@/lib/marketing/people";
import { readMarketingStore } from "@/lib/marketing/store";
import type { MarketingStatus } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const status = (searchParams.get("status") as MarketingStatus | null) ?? undefined;
  const people = await listMarketingPeople({ q, status: status || undefined, limit: 500 });
  const { store } = await readMarketingStore();
  return NextResponse.json({
    people,
    totals: {
      all: store.people.length,
      subscribed: store.people.filter((p) => p.status === "subscribed").length,
      unsubscribed: store.people.filter((p) => p.status === "unsubscribed").length,
      cleaned: store.people.filter((p) => p.status === "cleaned").length,
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  const result = await upsertMarketingPerson({
    email: body.email,
    displayName: typeof body.displayName === "string" ? body.displayName : null,
    city: typeof body.city === "string" ? body.city : null,
    status: typeof body.status === "string" ? (body.status as MarketingStatus) : "subscribed",
    marketingConsent: body.marketingConsent !== false,
    consentSource: "manual",
    acquisitionSource: "manual",
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [],
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ person: result.person, created: result.created });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const existing = await getMarketingPerson(body.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await upsertMarketingPerson({
    email: existing.email,
    displayName: typeof body.displayName === "string" ? body.displayName : existing.displayName,
    city: typeof body.city === "string" ? body.city : existing.city,
    status: typeof body.status === "string" ? (body.status as MarketingStatus) : existing.status,
    marketingConsent:
      typeof body.marketingConsent === "boolean" ? body.marketingConsent : existing.marketingConsent,
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : existing.tags,
    respectSuppression: false,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ person: result.person });
}
