import { NextResponse } from "next/server";
import { marketingErrorResponse } from "@/lib/marketing/auth";
import { getMarketingSettings } from "@/lib/marketing/db/settings";
import { upsertPerson } from "@/lib/marketing/db/people";

export const dynamic = "force-dynamic";

function extractEmail(body: Record<string, unknown>): string | null {
  const candidates = [
    body.email,
    body.Email,
    body.EMAIL,
    (body.data as Record<string, unknown> | undefined)?.email,
    (body.fieldData as Record<string, unknown> | undefined)?.email,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) return candidate;
  }
  return null;
}

function authorize(request: Request, secret: string | null): boolean {
  if (!secret) return false;
  const header = request.headers.get("x-marketing-ingest-secret") || request.headers.get("authorization");
  if (!header) return false;
  return header === secret || header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  try {
    const settings = await getMarketingSettings();
    if (!authorize(request, settings.ingestSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const email = extractEmail(body);
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const city =
      typeof body.city === "string"
        ? body.city
        : typeof (body.data as Record<string, unknown> | undefined)?.city === "string"
          ? ((body.data as Record<string, unknown>).city as string)
          : null;
    const name =
      typeof body.name === "string" ? body.name : typeof body.fullName === "string" ? body.fullName : null;

    const result = await upsertPerson({
      email,
      displayName: name,
      city,
      status: "subscribed",
      marketingConsent: true,
      consentSource: "squarespace",
      acquisitionSource: "squarespace",
      acquisitionDetail: { rawKeys: Object.keys(body) },
      externalId: typeof body.id === "string" ? body.id : null,
      respectSuppression: true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      personId: result.person.id,
      created: result.created,
      skippedReason: result.skippedReason,
    });
  } catch (err) {
    return marketingErrorResponse(err);
  }
}
