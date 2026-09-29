import type { MarketingEmail } from "../types";
import { getEventForMarketingBlock } from "../events-readonly";
import { startListSend } from "../send/queue";
import { sendTestEmail } from "../send/test-send";
import type { EventBlockData } from "./render";

export function marketingSendsAllowed(settingsEnabled: boolean): { ok: true } | { ok: false; error: string } {
  if (process.env.MARKETING_SENDS_ENABLED === "false") {
    return { ok: false, error: "Marketing sends disabled by MARKETING_SENDS_ENABLED=false." };
  }
  if (!settingsEnabled) {
    return { ok: false, error: "Marketing sends are paused in Settings → Marketing. Enable sends first." };
  }
  return { ok: true };
}

export async function resolveEventBlocks(
  email: MarketingEmail,
  baseUrl: string
): Promise<Record<string, EventBlockData>> {
  const out: Record<string, EventBlockData> = {};
  for (const block of email.blocks) {
    if (block.type !== "event") continue;
    const eventId = typeof block.props.eventId === "string" ? block.props.eventId : null;
    if (!eventId) {
      out[block.id] = {
        title: typeof block.props.title === "string" ? block.props.title : "Event",
        description: typeof block.props.description === "string" ? block.props.description : null,
        heroImage: typeof block.props.heroImage === "string" ? block.props.heroImage : null,
        venue: typeof block.props.venue === "string" ? block.props.venue : null,
        date: typeof block.props.date === "string" ? block.props.date : null,
        url: typeof block.props.url === "string" ? block.props.url : baseUrl,
        ctaText: typeof block.props.ctaText === "string" ? block.props.ctaText : "Open event",
      };
      continue;
    }
    const data = await getEventForMarketingBlock(eventId, baseUrl);
    if (data) out[block.id] = data;
  }
  return out;
}

export async function sendMarketingTestEmail(input: {
  emailId: string;
  to: string;
}): Promise<{ ok: true; providerMessageId: string } | { ok: false; error: string }> {
  const result = await sendTestEmail({ sendId: input.emailId, to: input.to });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, providerMessageId: result.providerMessageId };
}

export async function sendMarketingEmailNow(input: {
  emailId: string;
  confirmPhrase: string;
}): Promise<
  | { ok: true; queued: number; sent: number; failed: number; skipped: number; remaining: number }
  | { ok: false; error: string }
> {
  const result = await startListSend({ sendId: input.emailId, confirmPhrase: input.confirmPhrase });
  if (!result.ok) return { ok: false, error: result.error };
  return result;
}
