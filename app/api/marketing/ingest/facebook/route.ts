import { NextResponse } from "next/server";
import { upsertMarketingPerson } from "@/lib/marketing/people";
import { readMarketingStore } from "@/lib/marketing/store";

export const dynamic = "force-dynamic";

function authorize(request: Request, secret: string | null): boolean {
  if (!secret) return false;
  const header = request.headers.get("x-marketing-ingest-secret") || request.headers.get("authorization");
  if (!header) return false;
  return header === secret || header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  const { store } = await readMarketingStore();
  if (!authorize(request, store.settings.ingestSecret)) {
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
      const f = field as Record<string, unknown>;
      const key = String(f.name ?? f.key ?? "").toLowerCase();
      const values = Array.isArray(f.values) ? f.values : [f.value];
      const value = values.map(String).join(" ").trim();
      if (key.includes("email")) email = value;
      if (key.includes("full_name") || key === "name") name = value;
      if (key.includes("city")) city = value;
    }
  } else if (fieldData && typeof fieldData === "object") {
    const fd = fieldData as Record<string, unknown>;
    if (typeof fd.email === "string") email = fd.email;
    if (typeof fd.full_name === "string") name = fd.full_name;
    if (typeof fd.city === "string") city = fd.city;
  }

  if (!email && typeof entry.email === "string") email = entry.email;
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const result = await upsertMarketingPerson({
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
}

/** Meta webhook verification challenge */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const { store } = await readMarketingStore();
  if (mode === "subscribe" && token && store.settings.ingestSecret && token === store.settings.ingestSecret && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
