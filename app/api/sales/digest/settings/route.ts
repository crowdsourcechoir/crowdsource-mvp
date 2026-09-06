import { NextResponse } from "next/server";
import vercelConfig from "@/vercel.json";
import { resolveDigestSettings } from "@/lib/sales/digest/settings";
import { chooseDigestTransport } from "@/lib/sales/digest/transport";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { writeWorkspaceSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

function digestCronSchedules(): string[] {
  const crons = (vercelConfig as { crons?: { path: string; schedule: string }[] }).crons ?? [];
  return crons.filter((c) => c.path === "/api/sales/cron/digest").map((c) => c.schedule);
}

async function payload() {
  const settings = await resolveDigestSettings();
  const gmail = await getGmailConnectionStatus().catch(() => ({ connected: false, email: null }));
  const transport = chooseDigestTransport({
    resendApiKey: process.env.RESEND_API_KEY,
    resendFrom: settings.fromEmail,
    configuredTo: settings.recipient,
    gmailConnected: gmail.connected,
    gmailEmail: gmail.email,
  });
  return {
    ...settings,
    providerConfigured: transport.transport !== "none",
    transport: transport.transport,
    transportReason: transport.reason ?? null,
    effectiveRecipient: transport.to,
    gmailEmail: gmail.email,
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    cronSchedules: digestCronSchedules(),
  };
}

export async function GET() {
  try {
    return NextResponse.json(await payload(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

/** Update operator overrides. Omitted keys keep their stored value; explicit null clears to env default. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const digest: Record<string, unknown> = {};

    if ("enabled" in body) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
      }
      digest.enabled = body.enabled;
    }
    if ("minScore" in body) {
      const value = body.minScore === null || body.minScore === "" ? null : Number(body.minScore);
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
        return NextResponse.json({ error: "minScore must be between 0 and 100" }, { status: 400 });
      }
      digest.minScore = value;
    }
    if ("targetCount" in body) {
      const value = body.targetCount === null || body.targetCount === "" ? null : Number(body.targetCount);
      if (value !== null && (!Number.isInteger(value) || value < 1 || value > 100)) {
        return NextResponse.json({ error: "targetCount must be a whole number from 1 to 100" }, { status: 400 });
      }
      digest.targetCount = value;
    }
    if ("recipient" in body) {
      const raw = typeof body.recipient === "string" ? body.recipient.trim() : "";
      if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return NextResponse.json({ error: "recipient must be a valid email address" }, { status: 400 });
      }
      digest.recipient = raw || null;
    }

    const written = await writeWorkspaceSettings({ digest });
    if (written.error) {
      return NextResponse.json({ error: written.error }, { status: 503 });
    }
    return NextResponse.json(await payload(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
