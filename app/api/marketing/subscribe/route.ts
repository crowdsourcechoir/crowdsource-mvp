import { NextResponse } from "next/server";
import { upsertPerson } from "@/lib/marketing/db/people";
import { marketingErrorResponse } from "@/lib/marketing/auth";
import { normalizeMarketingEmail } from "@/lib/marketing/ids";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (typeof body.company_website === "string" && body.company_website.trim()) {
      return NextResponse.json({ ok: true, state: "subscribed" });
    }
    const email = typeof body.email === "string" ? body.email : "";
    if (!normalizeMarketingEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const result = await upsertPerson({
      email,
      displayName: typeof body.displayName === "string" ? body.displayName.slice(0, 200) : null,
      city: typeof body.city === "string" ? body.city.slice(0, 80) : null,
      status: "subscribed",
      marketingConsent: true,
      consentSource: "public_subscribe",
      acquisitionSource: "other",
      acquisitionDetail: { via: "subscribe_page" },
      respectSuppression: true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    if (result.skippedReason || result.person.status !== "subscribed") {
      return NextResponse.json({ ok: true, state: "kept_off" });
    }
    return NextResponse.json({ ok: true, state: result.created ? "subscribed" : "already" });
  } catch (err) {
    return marketingErrorResponse(err);
  }
}
