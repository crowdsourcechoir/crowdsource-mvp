import { NextResponse } from "next/server";
import { inquiryText, validateInquiry } from "@/lib/choir-site/forms";
import { mailtoHref, sendChoirNote } from "@/lib/choir-site/notify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateInquiry(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.spam) return NextResponse.json({ ok: true, delivered: true });

  const text = inquiryText(parsed.value);
  const subject = `Booking inquiry from ${parsed.value.firstName} ${parsed.value.lastName}`;
  const mailed = await sendChoirNote(subject, text, parsed.value.email);
  if (mailed) return NextResponse.json({ ok: true, delivered: true });
  return NextResponse.json({ ok: true, delivered: false, mailto: mailtoHref(subject, text) });
}
