export const DELIVERY_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  delayed: 2,
  sent: 3,
  delivered: 4,
  failed: 5,
  bounced: 6,
  complained: 7,
  suppressed: 8,
  cancelled: 8,
};

export type MappedWebhook = {
  eventType: "sent" | "delivered" | "delivery_delayed" | "bounced" | "complained" | "opened" | "clicked" | "failed" | "unknown";
  nextStatus: string | null;
  suppress: "hard_bounce" | "complaint" | null;
  unsubscribe: boolean;
};

export function mapResendWebhook(type: string, data: Record<string, unknown>): MappedWebhook {
  if (type === "email.sent") return { eventType: "sent", nextStatus: "sent", suppress: null, unsubscribe: false };
  if (type === "email.delivered") return { eventType: "delivered", nextStatus: "delivered", suppress: null, unsubscribe: false };
  if (type === "email.delivery_delayed") return { eventType: "delivery_delayed", nextStatus: "delayed", suppress: null, unsubscribe: false };
  if (type === "email.failed") return { eventType: "failed", nextStatus: "failed", suppress: null, unsubscribe: false };
  if (type === "email.complained") return { eventType: "complained", nextStatus: "complained", suppress: "complaint", unsubscribe: true };
  if (type === "email.clicked") return { eventType: "clicked", nextStatus: null, suppress: null, unsubscribe: false };
  if (type === "email.opened") return { eventType: "opened", nextStatus: null, suppress: null, unsubscribe: false };
  if (type === "email.bounced") {
    const bounce = data.bounce;
    const bounceType =
      bounce && typeof bounce === "object" && typeof (bounce as { type?: unknown }).type === "string"
        ? (bounce as { type: string }).type.toLowerCase()
        : "";
    const hard = bounceType.includes("permanent") || bounceType.includes("hard");
    if (!hard) return { eventType: "bounced", nextStatus: "delayed", suppress: null, unsubscribe: false };
    return { eventType: "bounced", nextStatus: "bounced", suppress: "hard_bounce", unsubscribe: false };
  }
  return { eventType: "unknown", nextStatus: null, suppress: null, unsubscribe: false };
}

export function forwardStatus(current: string, next: string | null): string | null {
  if (!next || next === current) return null;
  if (current === "cancelled" || current === "suppressed") return null;
  if (next === "complained") return "complained";
  if (current === "complained") return null;
  if (next === "bounced") return "bounced";
  if (current === "bounced") return null;
  if (next === "failed") {
    if (current === "delivered") return null;
    return "failed";
  }
  if (next === "delayed") {
    if (current === "queued" || current === "sending" || current === "sent") return "delayed";
    return null;
  }
  if ((DELIVERY_RANK[next] ?? 0) > (DELIVERY_RANK[current] ?? 0)) return next;
  return null;
}
