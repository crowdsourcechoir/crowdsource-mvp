import { NextResponse } from "next/server";
import { audienceToCsv } from "@/lib/marketing/audience-csv";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { audienceTotals, getPerson, listPeople, setPersonTags, upsertPerson } from "@/lib/marketing/db/people";
import type { MarketingStatus } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseLimit(raw: string | null): number | null {
  if (raw === "all") return null;
  if (raw === "100" || raw === "500" || raw === "1000") return Number(raw);
  return 100;
}

export async function GET(request: Request) {
  return withMarketingAuth(async () => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const status = (searchParams.get("status") as MarketingStatus | null) ?? undefined;
    const csv = searchParams.get("format") === "csv";
    const listed = await listPeople({
      q,
      status: status || undefined,
      limit: csv ? null : parseLimit(searchParams.get("limit")),
    });
    if (csv) {
      return new NextResponse(audienceToCsv(listed.people), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audience.csv"',
        },
      });
    }
    const totals = await audienceTotals();
    const matched = q?.trim() || status ? listed.matched : totals.all;
    return NextResponse.json({ people: listed.people, totals, matched });
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
      region: typeof body.region === "string" ? body.region : existing.region,
      country: typeof body.country === "string" ? body.country : existing.country,
      status: typeof body.status === "string" ? (body.status as MarketingStatus) : existing.status,
      marketingConsent: typeof body.marketingConsent === "boolean" ? body.marketingConsent : existing.marketingConsent,
      respectSuppression: false,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    if (Array.isArray(body.tags)) {
      await setPersonTags(
        existing.id,
        body.tags.filter((tag): tag is string => typeof tag === "string")
      );
    }
    const person = await getPerson(existing.id);
    return NextResponse.json({ person: person ?? result.person, skippedReason: result.skippedReason });
  });
}
