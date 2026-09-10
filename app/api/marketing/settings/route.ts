import { NextResponse } from "next/server";
import { readMarketingStore, updateMarketingStore } from "@/lib/marketing/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { store, error } = await readMarketingStore();
  return NextResponse.json({
    settings: store.settings,
    resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    envSendsEnabled: process.env.MARKETING_SENDS_ENABLED !== "false",
    error,
    totals: {
      people: store.people.length,
      subscribed: store.people.filter((p) => p.status === "subscribed").length,
      campaigns: store.campaigns.length,
      emailsSent: store.emails.filter((e) => e.status === "sent").length,
    },
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  await updateMarketingStore((store) => {
    if (typeof body.sendsEnabled === "boolean") store.settings.sendsEnabled = body.sendsEnabled;
    if (typeof body.fromName === "string") store.settings.fromName = body.fromName;
    if (typeof body.fromEmail === "string") store.settings.fromEmail = body.fromEmail.trim();
    if (typeof body.replyTo === "string" || body.replyTo === null) {
      store.settings.replyTo = body.replyTo as string | null;
    }
    if (typeof body.physicalAddress === "string") store.settings.physicalAddress = body.physicalAddress;
    if (typeof body.companyName === "string") store.settings.companyName = body.companyName;
    if (typeof body.ingestSecret === "string" || body.ingestSecret === null) {
      store.settings.ingestSecret = body.ingestSecret as string | null;
    }
  });
  const { store } = await readMarketingStore();
  return NextResponse.json({ settings: store.settings });
}
