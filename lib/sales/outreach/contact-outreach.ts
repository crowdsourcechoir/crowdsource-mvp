import type { OutreachActivity } from "../types";
import { decodeHtmlEntities } from "./email-body-format";
import { correspondentFromActivity, type CorrespondentContact } from "./reply-correspondent";

export type ContactOutreach = {
  sentAt: string | null;
  repliedAt: string | null;
  replyKind: "live" | "auto" | null;
  bouncedAt: string | null;
  snippet: string | null;
  gmailThreadId: string | null;
  gmailMessageId: string | null;
};

const EMPTY: ContactOutreach = {
  sentAt: null,
  repliedAt: null,
  bouncedAt: null,
  replyKind: null,
  snippet: null,
  gmailThreadId: null,
  gmailMessageId: null,
};

function snippetOf(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.snippet;
  if (typeof value !== "string" || !value.trim()) return null;
  return decodeHtmlEntities(value.trim());
}

function replyKindOf(metadata: Record<string, unknown> | null): "live" | "auto" | null {
  const value = metadata?.replyKind;
  return value === "auto" || value === "live" ? value : null;
}

function later(iso: string | null, next: string): string {
  if (!iso) return next;
  return new Date(next).getTime() >= new Date(iso).getTime() ? next : iso;
}

/** Latest send / reply / bounce per contact (and a fallback keyed by empty string for unmatched rows). */
export function contactOutreachById(
  activities: OutreachActivity[],
  contacts: CorrespondentContact[] = []
): Record<string, ContactOutreach> {
  const byId: Record<string, ContactOutreach> = {};
  const sorted = [...activities].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (const activity of sorted) {
    const correspondent =
      activity.activityType === "replied" && contacts.length > 0
        ? correspondentFromActivity(activity, contacts)
        : null;
    const key = correspondent?.contactId || activity.contactId || "";
    const cur = byId[key] ?? { ...EMPTY };
    if (activity.gmailThreadId) {
      cur.gmailThreadId = activity.gmailThreadId;
      cur.gmailMessageId = activity.gmailMessageId;
    }
    if (activity.activityType === "sent") {
      cur.sentAt = later(cur.sentAt, activity.occurredAt);
    } else if (activity.activityType === "replied") {
      cur.repliedAt = later(cur.repliedAt, activity.occurredAt);
      cur.replyKind = replyKindOf(activity.metadata) ?? cur.replyKind ?? "live";
      cur.snippet = snippetOf(activity.metadata) ?? cur.snippet;
      cur.gmailMessageId = activity.gmailMessageId ?? cur.gmailMessageId;
    } else if (activity.activityType === "bounced") {
      cur.bouncedAt = later(cur.bouncedAt, activity.occurredAt);
      cur.snippet = snippetOf(activity.metadata) ?? cur.snippet;
    }
    byId[key] = cur;
  }
  return byId;
}

export function outreachLabel(row: ContactOutreach | null | undefined): { text: string; className: string } | null {
  if (!row) return null;
  if (row.bouncedAt) return { text: "bounced", className: "text-red-400" };
  const sentAfterReply =
    Boolean(row.sentAt) &&
    Boolean(row.repliedAt) &&
    new Date(row.sentAt!).getTime() >= new Date(row.repliedAt!).getTime();
  if (sentAfterReply) return { text: "sent", className: "text-[var(--csc-accent)]" };
  if (row.repliedAt && row.replyKind === "auto") return { text: "auto-reply", className: "text-amber-300" };
  if (row.repliedAt) return { text: "replied", className: "text-[var(--csc-accent)]" };
  if (row.sentAt) return { text: "sent", className: "text-[var(--csc-accent)]" };
  return null;
}

export type OpportunityOutreachKind = "none" | "sent" | "awaiting" | "replied" | "bounced";

export function opportunityOutreachKind(input: {
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  bounced?: boolean;
}): OpportunityOutreachKind {
  if (input.bounced) return "bounced";
  if (input.lastInboundAt) {
    if (
      input.lastOutboundAt &&
      new Date(input.lastOutboundAt).getTime() >= new Date(input.lastInboundAt).getTime()
    ) {
      return "sent";
    }
    return "replied";
  }
  if (input.lastOutboundAt) return "sent";
  return "none";
}
