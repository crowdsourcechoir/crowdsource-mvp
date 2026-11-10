/**
 * Follow-ups and nudges are the same queue bucket.
 * A row marked kind "nudge" belongs in Follow-ups (scope "due"), alongside
 * scheduled reply follow-ups.
 */

export function isNudgeFollowUp(item: { kind?: string | null }): boolean {
  return item.kind === "nudge";
}

/** Keep every scheduled follow-up, then every nudge that is not already in that list. */
export function mergeFollowUpQueueItems<T extends { id: string; kind?: string | null }>(
  followUps: T[],
  nudges: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of followUps) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  for (const item of nudges) {
    if (!isNudgeFollowUp(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
