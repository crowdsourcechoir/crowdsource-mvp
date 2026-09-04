import { replyKindFromActivity, sendKindFromMetadata } from "./inbound-kind";

export type MetricActivity = {
  id: string;
  opportunityId: string;
  contactId: string | null;
  activityType: "sent" | "replied" | "bounced" | string;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
  gmailThreadId?: string | null;
  organizationName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  opportunityTitle?: string | null;
  relationshipStage?: string | null;
};

export type FirstTouchRow = {
  key: string;
  opportunityId: string;
  contactId: string | null;
  sentAt: string;
  outcome: "live" | "auto" | "bounced" | "awaiting" | "won" | "lost";
  outcomeAt: string | null;
};

export type FirstTouchEvent = {
  id: string;
  occurredAt: string;
  kind: "sent" | "replied" | "auto" | "bounced";
  opportunityId: string;
  organizationName: string;
  contactName: string | null;
  snippet: string | null;
};

export type FirstTouchSnapshot = {
  emailsSent: number;
  emailsSent7d: number;
  firstTouches: number;
  firstTouches7d: number;
  liveReplies: number;
  autoReplies: number;
  bounces: number;
  awaiting: number;
  won: number;
  lost: number;
  liveReplyRate: number | null;
  bounceRate: number | null;
  liveReplies7d: number;
  events: FirstTouchEvent[];
  recentLiveReplies: FirstTouchEvent[];
  recentBounces: FirstTouchEvent[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function snippetOf(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.snippet;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function inLast7Days(iso: string, nowMs: number): boolean {
  return nowMs - new Date(iso).getTime() <= WEEK_MS;
}

function eventMatchesTouch(
  touch: { opportunityId: string; contactId: string | null },
  event: { opportunityId: string; contactId: string | null }
): boolean {
  if (touch.opportunityId !== event.opportunityId) return false;
  if (touch.contactId && event.contactId) return touch.contactId === event.contactId;
  return true;
}

export function buildFirstTouchSnapshot(
  activities: MetricActivity[],
  nowMs: number = Date.now()
): FirstTouchSnapshot {
  const sent = activities.filter((a) => a.activityType === "sent");
  const firstSends = sent
    .filter((a) => sendKindFromMetadata(a.metadata) === "initial")
    .slice()
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  const replies = activities.filter((a) => a.activityType === "replied");
  const bounces = activities.filter((a) => a.activityType === "bounced");

  const touches: FirstTouchRow[] = firstSends.map((send) => {
    const laterReplies = replies
      .filter((reply) => eventMatchesTouch(send, reply) && reply.occurredAt >= send.occurredAt)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const laterBounces = bounces
      .filter((bounce) => eventMatchesTouch(send, bounce) && bounce.occurredAt >= send.occurredAt)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    const live = laterReplies.find((reply) => replyKindFromActivity({ metadata: reply.metadata }) === "live");
    const auto = laterReplies.find((reply) => replyKindFromActivity({ metadata: reply.metadata }) === "auto");
    const bounce = laterBounces[0];
    const stage = send.relationshipStage;

    let outcome: FirstTouchRow["outcome"] = "awaiting";
    let outcomeAt: string | null = null;
    if (live) {
      outcome = "live";
      outcomeAt = live.occurredAt;
    } else if (bounce) {
      outcome = "bounced";
      outcomeAt = bounce.occurredAt;
    } else if (auto) {
      outcome = "auto";
      outcomeAt = auto.occurredAt;
    } else if (stage === "purchase") {
      outcome = "won";
      outcomeAt = send.occurredAt;
    } else if (stage === "lost") {
      outcome = "lost";
      outcomeAt = send.occurredAt;
    } else if (stage === "interest") {
      // Manual "Mark replied" with no Gmail sync still counts as a live response.
      outcome = "live";
      outcomeAt = send.occurredAt;
    }

    return {
      key: `${send.opportunityId}:${send.contactId ?? "none"}:${send.id}`,
      opportunityId: send.opportunityId,
      contactId: send.contactId,
      sentAt: send.occurredAt,
      outcome,
      outcomeAt,
    };
  });

  const uniqueTouches = new Map<string, FirstTouchRow>();
  for (const touch of touches) {
    const key = `${touch.opportunityId}:${touch.contactId ?? "none"}`;
    const existing = uniqueTouches.get(key);
    if (!existing || touch.sentAt < existing.sentAt) uniqueTouches.set(key, touch);
  }
  const firstTouches = Array.from(uniqueTouches.values());

  const liveReplies = firstTouches.filter((t) => t.outcome === "live").length;
  const autoReplies = firstTouches.filter((t) => t.outcome === "auto").length;
  const bounceCount = firstTouches.filter((t) => t.outcome === "bounced").length;
  const awaiting = firstTouches.filter((t) => t.outcome === "awaiting").length;
  const won = firstTouches.filter((t) => t.outcome === "won").length;
  const lost = firstTouches.filter((t) => t.outcome === "lost").length;
  const firstTouches7d = firstTouches.filter((t) => inLast7Days(t.sentAt, nowMs)).length;

  const toEvent = (activity: MetricActivity, kind: FirstTouchEvent["kind"]): FirstTouchEvent => ({
    id: activity.id,
    occurredAt: activity.occurredAt,
    kind,
    opportunityId: activity.opportunityId,
    organizationName: activity.organizationName ?? "Unknown org",
    contactName: activity.contactName ?? activity.contactEmail ?? null,
    snippet: snippetOf(activity.metadata),
  });

  const events: FirstTouchEvent[] = [];
  for (const activity of activities) {
    if (activity.activityType === "sent" && sendKindFromMetadata(activity.metadata) === "initial") {
      events.push(toEvent(activity, "sent"));
    } else if (activity.activityType === "replied") {
      events.push(
        toEvent(activity, replyKindFromActivity({ metadata: activity.metadata }) === "auto" ? "auto" : "replied")
      );
    } else if (activity.activityType === "bounced") {
      events.push(toEvent(activity, "bounced"));
    }
  }
  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return {
    emailsSent: sent.length,
    emailsSent7d: sent.filter((a) => inLast7Days(a.occurredAt, nowMs)).length,
    firstTouches: firstTouches.length,
    firstTouches7d,
    liveReplies,
    autoReplies,
    bounces: bounceCount,
    awaiting,
    won,
    lost,
    liveReplyRate: rate(liveReplies, firstTouches.length),
    bounceRate: rate(bounceCount, firstTouches.length),
    liveReplies7d: replies.filter(
      (a) => inLast7Days(a.occurredAt, nowMs) && replyKindFromActivity({ metadata: a.metadata }) === "live"
    ).length,
    events: events.slice(0, 40),
    recentLiveReplies: events.filter((e) => e.kind === "replied").slice(0, 12),
    recentBounces: events.filter((e) => e.kind === "bounced").slice(0, 12),
  };
}
