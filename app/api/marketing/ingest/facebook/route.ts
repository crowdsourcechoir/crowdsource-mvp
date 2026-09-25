import { NextResponse } from "next/server";
import { marketingErrorResponse } from "@/lib/marketing/auth";
import { upsertPerson } from "@/lib/marketing/db/people";
import { getMarketingSettings } from "@/lib/marketing/db/settings";

export const dynamic = "force-dynamic";

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

    const entry = (body.entry ?? body.lead ?? body) as Record<string, unknown>;
    const fieldData = (entry.field_data ?? entry.fieldData ?? entry) as Record<string, unknown> | unknown[];
    let email: string | null = null;
    let name: string | null = null;
    let city: string | null = null;

    if (Array.isArray(fieldData)) {
      for (const field of fieldData) {
        if (!field || typeof field !== "object") continue;
        const record = field as Record<string, unknown>;
        const key = String(record.name ?? record.key ?? "").toLowerCase();
        const values = Array.isArray(record.values) ? record.values : [record.value];
        const value = values.map(String).join(" ").trim();
        if (key.includes("email")) email = value;
        if (key.includes("full_name") || key === "name") name = value;
        if (key.includes("city")) city = value;
      }
    } else if (fieldData && typeof fieldData === "object") {
      const record = fieldData as Record<string, unknown>;
      if (typeof record.email === "string") email = record.email;
      if (typeof record.full_name === "string") name = record.full_name;
      if (typeof record.city === "string") city = record.city;
    }

    if (!email && typeof entry.email === "string") email = entry.email;
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const result = await upsertPerson({
      email,
      displayName: name,
      city,
      status: "subscribed",
      marketingConsent: true,
      consentSource: "facebook",
      acquisitionSource: "facebook",
      acquisitionDetail: { leadgenId: entry.leadgen_id ?? entry.id ?? null },
      externalId: typeof entry.leadgen_id === "string" ? entry.leadgen_id : typeof entry.id === "string" ? entry.id : null,
      respectSuppression: true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, personId: result.person.id, created: result.created });
  } catch (err) {
    return marketingErrorResponse(err);
  }
}

/** Meta webhook verification challenge */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const settings = await getMarketingSettings();
    if (mode === "subscribe" && token && settings.ingestSecret && token === settings.ingestSecret && challenge) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    return marketingErrorResponse(err);
  }
}
