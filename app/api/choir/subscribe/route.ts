import { NextResponse } from "next/server";
import { upsertPerson } from "@/lib/marketing/db/people";
import { mailtoHref, sendChoirNote } from "@/lib/choir-site/notify";
import { subscribeText, validateSubscribe } from "@/lib/choir-site/forms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateSubscribe(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.spam) return NextResponse.json({ ok: true, delivered: true });

  const value = parsed.value;
  let listed = false;
  try {
    const result = await upsertPerson({
      email: value.email,
      displayName: value.name,
      city: value.city || null,
      status: "subscribed",
      marketingConsent: true,
      consentSource: "public_subscribe",
      acquisitionSource: "other",
      acquisitionDetail: { via: "choir_site", note: value.note || null },
      respectSuppression: true,
    });
    listed = result.ok && !result.skippedReason && result.person.status === "subscribed";
  } catch {
    listed = false;
  }

  const text = subscribeText(value);
  const mailed = await sendChoirNote("Choir list signup", text, value.email);
  if (listed || mailed) return NextResponse.json({ ok: true, delivered: true, listed });
  return NextResponse.json({ ok: true, delivered: false, mailto: mailtoHref("Choir list signup", text) });
}
