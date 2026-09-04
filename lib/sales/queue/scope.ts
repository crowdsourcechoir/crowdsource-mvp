export const QUEUE_SCOPES = ["to_send", "due", "all"] as const;
export type QueueScope = (typeof QUEUE_SCOPES)[number];

export const QUEUE_SCOPE_CHIPS: { key: QueueScope; label: string }[] = [
  { key: "to_send", label: "To send" },
  { key: "due", label: "Due today" },
  { key: "all", label: "All orgs" },
];

export function parseQueueScope(raw: string | null | undefined): QueueScope {
  return raw === "due" || raw === "all" ? raw : "to_send";
}
