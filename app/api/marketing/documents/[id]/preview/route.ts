import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { getWorkingDocument } from "@/lib/marketing/db/documents";
import { getMarketingSettings } from "@/lib/marketing/db/settings";
import { getEventForMarketingBlock } from "@/lib/marketing/events-readonly";
import type { EmailDocument } from "@/lib/marketing/document/types";
import { compileEmailDocument } from "@/lib/marketing/render/compile";
import type { EventBlockData } from "@/lib/marketing/render/event-data";
import { personalizeEmail } from "@/lib/marketing/render/personalize";
import { resolveEmailTokens } from "@/lib/marketing/render/tokens";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "https://app.crowdsourcechoir.com";
}

function propString(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value : "";
}

async function resolveEvents(document: EmailDocument, origin: string): Promise<Record<string, EventBlockData>> {
  const events: Record<string, EventBlockData> = {};
  for (const section of document.sections) {
    if (section.type !== "event") continue;
    const eventId = propString(section.props, "eventId");
    if (!eventId) continue;
    const resolved = await getEventForMarketingBlock(eventId, origin);
    if (resolved) events[section.id] = resolved;
  }
  return events;
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withMarketingAuth(async () => {
    const { id } = await ctx.params;
    const loaded = await getWorkingDocument(id);
    if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = await getMarketingSettings();
    const origin = baseUrl();
    const tokens = resolveEmailTokens(loaded.tokens);
    const compiled = compileEmailDocument({
      document: loaded.document,
      tokens,
      previewText: loaded.previewText,
      companyName: settings.companyName,
      physicalAddress: settings.physicalAddress,
      eventsBySectionId: await resolveEvents(loaded.document, origin),
    });
    if (!compiled.ok) {
      return NextResponse.json({ html: "", text: compiled.text, errors: compiled.errors }, { status: 422 });
    }
    const personalized = personalizeEmail(
      compiled,
      {
        first_name: null,
        display_name: null,
        city: null,
        email: "preview@example.com",
        unsubscribe_url: `${origin}/api/marketing/unsubscribe?email=preview@example.com`,
      },
      loaded.document.personalization
    );
    return NextResponse.json({
      html: personalized.html,
      text: personalized.text,
      errors: compiled.warnings,
    });
  });
}
