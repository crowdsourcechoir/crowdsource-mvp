import type { PromptGameSession, PromptGameSubmission, LiveDisplayMode, LiveMediaType } from "@/data/livePromptGame";

export function rowToSession(row: Record<string, unknown>): PromptGameSession {
  const mode = row.display_mode === "approve_first" ? "approve_first" : "auto";
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: (row.name as string) ?? "Live Prompt Game",
    state: (row.state as PromptGameSession["state"]) ?? "WAITING",
    current_round_id: (row.current_round_id as string | null) ?? null,
    linked_event_id: (row.linked_event_id as string | null) ?? null,
    display_mode: mode as LiveDisplayMode,
    created_at: String(row.created_at),
    ended_at: (row.ended_at as string | null) ?? null,
  };
}

export function rowToSubmission(row: Record<string, unknown>): PromptGameSubmission {
  const mediaType =
    row.media_type === "photo" || row.media_type === "sound" || row.media_type === "video"
      ? (row.media_type as LiveMediaType)
      : null;
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    round_id: String(row.round_id),
    device_id: String(row.device_id),
    raw_text: String(row.raw_text ?? ""),
    created_at: String(row.created_at),
    hidden: row.hidden === true,
    locked: row.locked === true,
    media_type: mediaType,
    media_url: row.media_url != null ? String(row.media_url) : null,
    media_path: row.media_path != null ? String(row.media_path) : null,
    media_mime: row.media_mime != null ? String(row.media_mime) : null,
    media_duration_ms: row.media_duration_ms != null ? Number(row.media_duration_ms) : null,
    approved: row.approved === true,
    garden_clip_id: row.garden_clip_id != null ? String(row.garden_clip_id) : null,
  };
}

/** Whether this submission should appear on the stage Display. */
export function isDisplayableSubmission(
  sub: PromptGameSubmission,
  displayMode: LiveDisplayMode
): boolean {
  if (sub.hidden) return false;
  if (!sub.media_type || !sub.media_url) return false;
  if (displayMode === "approve_first") return sub.approved;
  return true;
}
