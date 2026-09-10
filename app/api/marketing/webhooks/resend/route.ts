import { NextResponse } from "next/server";
import { newId } from "@/lib/marketing/ids";
import { updateMarketingStore } from "@/lib/marketing/store";

export const dynamic = "force-dynamic";

/**
 * Resend webhook receiver. Configure in Resend dashboard to POST here.
 * Updates recipient status + email stats. Does not touch Gardens/Blooms.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const type = typeof body.type === "string" ? body.type : "unknown";
  const data = (body.data ?? {}) as Record<string, unknown>;
  const providerMessageId = typeof data.email_id === "string" ? data.email_id : typeof data.id === "string" ? data.id : null;
  const toEmail = Array.isArray(data.to) ? String(data.to[0] ?? "") : typeof data.to === "string" ? data.to : null;

  await updateMarketingStore((store) => {
    const now = new Date().toISOString();
    let recipient = providerMessageId
      ? store.recipients.find((r) => r.providerMessageId === providerMessageId)
      : null;
    if (!recipient && toEmail) {
      recipient = store.recipients.find((r) => r.toEmail.toLowerCase() === toEmail.toLowerCase());
    }

    store.deliveryEvents.unshift({
      id: newId("dev"),
      recipientId: recipient?.id ?? null,
      emailId: recipient?.emailId ?? null,
      type,
      meta: { providerMessageId, toEmail },
      occurredAt: now,
    });
    store.deliveryEvents = store.deliveryEvents.slice(0, 5000);

    if (!recipient) return;
    recipient.lastEventAt = now;
    const email = store.emails.find((e) => e.id === recipient!.emailId);

    if (type.includes("delivered")) {
      recipient.status = "delivered";
      if (email) email.stats.delivered += 1;
    } else if (type.includes("bounced") || type.includes("failed")) {
      recipient.status = "bounced";
      if (email) email.stats.bounced += 1;
      const person = store.people.find((p) => p.id === recipient!.personId);
      if (person) {
        person.bounceClass = "hard";
        person.status = "cleaned";
        person.suppressedAt = now;
        person.updatedAt = now;
      }
    } else if (type.includes("complained")) {
      recipient.status = "complained";
      if (email) email.stats.complained += 1;
      const person = store.people.find((p) => p.id === recipient!.personId);
      if (person) {
        person.status = "unsubscribed";
        person.marketingConsent = false;
        person.suppressedAt = now;
        person.updatedAt = now;
      }
    } else if (type.includes("opened")) {
      if (email) email.stats.opened += 1;
    } else if (type.includes("clicked")) {
      if (email) email.stats.clicked += 1;
    }
  });

  return NextResponse.json({ ok: true });
}
