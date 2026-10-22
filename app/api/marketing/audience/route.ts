import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { audienceTotals, getPerson, listPeople, upsertPerson } from "@/lib/marketing/db/people";
import type { MarketingStatus } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMarketingAuth(async () => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const status = (searchParams.get("status") as MarketingStatus | null) ?? undefined;
    const [people, totals] = await Promise.all([
      listPeople({ q, status: status || undefined, limit: 500 }),
      audienceTotals(),
    ]);
    return NextResponse.json({ people, totals });
  });
}

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.email !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    const result = await upsertPerson({
      email: body.email,
      displayName: typeof body.displayName === "string" ? body.displayName : null,
      city: typeof body.city === "string" ? body.city : null,
      status: typeof body.status === "string" ? (body.status as MarketingStatus) : "subscribed",
      marketingConsent: body.marketingConsent !== false,
      consentSource: "manual",
      acquisitionSource: "manual",
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [],
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ person: result.person, created: result.created, skippedReason: result.skippedReason });
  });
}

export async function PATCH(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const existing = await getPerson(body.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await upsertPerson({
      email: existing.email,
      displayName: typeof body.displayName === "string" ? body.displayName : existing.displayName,
      city: typeof body.city === "string" ? body.city : existing.city,
      status: typeof body.status === "string" ? (body.status as MarketingStatus) : existing.status,
      marketingConsent: typeof body.marketingConsent === "boolean" ? body.marketingConsent : existing.marketingConsent,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : existing.tags,
      respectSuppression: false,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ person: result.person, skippedReason: result.skippedReason });
  });
}
