import { Resend } from "resend";
import { newId } from "../ids";
import { evaluateSegment, isSendable } from "../segments";
import { readMarketingStore, updateMarketingStore } from "../store";
import type { MarketingEmail, MarketingRecipient } from "../types";
import { getEventForMarketingBlock } from "../events-readonly";
import { renderMarketingEmail, type EventBlockData } from "./render";

function resolveBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "https://app.crowdsourcechoir.com";
}

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

async function sendViaResend(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
}): Promise<string> {
  const resend = new Resend(input.apiKey);
  const { data, error } = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo || undefined,
    headers: input.headers,
  });
  if (error) throw new Error(error.message);
  return data?.id ?? `resend_${Date.now()}`;
}

export async function sendMarketingTestEmail(input: {
  emailId: string;
  to: string;
}): Promise<{ ok: true; providerMessageId: string } | { ok: false; error: string }> {
  const { store } = await readMarketingStore();
  const email = store.emails.find((e) => e.id === input.emailId);
  if (!email) return { ok: false, error: "Email not found" };
  const gate = marketingSendsAllowed(store.settings.sendsEnabled);
  // Allow test sends even when paused? Safer: require enabled OR explicit env override.
  // For operator UX, allow test when Resend configured; still respect hard env kill.
  if (process.env.MARKETING_SENDS_ENABLED === "false") {
    return { ok: false, error: "Marketing sends disabled by MARKETING_SENDS_ENABLED=false." };
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured." };

  const fromEmail = email.fromEmail || store.settings.fromEmail;
  if (!fromEmail) return { ok: false, error: "Set a verified from email in Marketing settings." };

  const baseUrl = resolveBaseUrl();
  const eventsByBlockId = await resolveEventBlocks(email, baseUrl);
  const rendered = renderMarketingEmail(email, {
    settings: store.settings,
    unsubscribeUrl: `${baseUrl}/api/marketing/unsubscribe?email=${encodeURIComponent(input.to)}`,
    baseUrl,
    eventsByBlockId,
  });

  try {
    const providerMessageId = await sendViaResend({
      apiKey,
      from: `${email.fromName || store.settings.fromName} <${fromEmail}>`,
      to: input.to,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      replyTo: email.replyTo || store.settings.replyTo,
    });
    return { ok: true, providerMessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

export async function sendMarketingEmailNow(input: {
  emailId: string;
  confirmPhrase: string;
}): Promise<{ ok: true; queued: number; sent: number; skipped: number } | { ok: false; error: string }> {
  if (input.confirmPhrase.trim().toUpperCase() !== "SEND") {
    return { ok: false, error: 'Type SEND to confirm the bulk send.' };
  }

  const { store } = await readMarketingStore();
  const gate = marketingSendsAllowed(store.settings.sendsEnabled);
  if (!gate.ok) return gate;

  const email = store.emails.find((e) => e.id === input.emailId);
  if (!email) return { ok: false, error: "Email not found" };
  if (email.status === "sent") return { ok: false, error: "This email was already sent." };
  if (!email.segmentId) return { ok: false, error: "Select a segment before sending." };

  const segment = store.segments.find((s) => s.id === email.segmentId);
  if (!segment) return { ok: false, error: "Segment not found" };

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured." };
  const fromEmail = email.fromEmail || store.settings.fromEmail;
  if (!fromEmail) return { ok: false, error: "Set a verified from email in Marketing settings." };

  const recipients = evaluateSegment(store.people, segment, { sendableOnly: true });
  if (recipients.length === 0) {
    return { ok: false, error: "Segment has no sendable subscribers (consent + subscribed required)." };
  }

  const baseUrl = resolveBaseUrl();
  const eventsByBlockId = await resolveEventBlocks(email, baseUrl);

  let sent = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  const newRecipients: MarketingRecipient[] = [];

  await updateMarketingStore((s) => {
    const target = s.emails.find((e) => e.id === input.emailId);
    if (target) {
      target.status = "sending";
      target.updatedAt = now;
    }
  });

  for (const person of recipients) {
    if (!isSendable(person)) {
      skipped += 1;
      continue;
    }
    const rendered = renderMarketingEmail(email, {
      settings: store.settings,
      unsubscribeUrl: `${baseUrl}/api/marketing/unsubscribe?email=${encodeURIComponent(person.email)}`,
      baseUrl,
      eventsByBlockId,
    });
    const recipientId = newId("rcp");
    try {
      const providerMessageId = await sendViaResend({
        apiKey,
        from: `${email.fromName || store.settings.fromName} <${fromEmail}>`,
        to: person.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: email.replyTo || store.settings.replyTo,
        headers: {
          "List-Unsubscribe": `<${baseUrl}/api/marketing/unsubscribe?email=${encodeURIComponent(person.email)}>`,
        },
      });
      sent += 1;
      newRecipients.push({
        id: recipientId,
        emailId: email.id,
        personId: person.id,
        toEmail: person.email,
        providerMessageId,
        status: "sent",
        lastEventAt: now,
        createdAt: now,
      });
    } catch {
      skipped += 1;
      newRecipients.push({
        id: recipientId,
        emailId: email.id,
        personId: person.id,
        toEmail: person.email,
        providerMessageId: null,
        status: "skipped",
        lastEventAt: now,
        createdAt: now,
      });
    }
  }

  await updateMarketingStore((s) => {
    const target = s.emails.find((e) => e.id === input.emailId);
    if (target) {
      target.status = "sent";
      target.sentAt = now;
      target.updatedAt = now;
      target.stats = {
        ...target.stats,
        queued: recipients.length,
        sent: target.stats.sent + sent,
      };
    }
    s.recipients.unshift(...newRecipients);
    s.recipients = s.recipients.slice(0, 20000);
  });

  return { ok: true, queued: recipients.length, sent, skipped };
}
