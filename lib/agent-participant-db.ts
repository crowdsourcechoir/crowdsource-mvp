/** Legacy production rows may only expose `name` on agent_participants. */

export type AgentParticipantIdentityRow = {
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

export const AGENT_PARTICIPANT_IDENTITY_SELECT = "id, name";

export function participantDisplayName(
  row: AgentParticipantIdentityRow | null | undefined
): string | null {
  const fromDisplay = row?.display_name?.trim();
  if (fromDisplay) return fromDisplay;
  const fromName = row?.name?.trim();
  return fromName || null;
}

export function participantInsertPayload(args: {
  eventId: string | null;
  localEventId: string | null;
  displayName: string | null;
  sessionToken: string;
}): Record<string, unknown> {
  return {
    event_id: args.eventId,
    local_event_id: args.localEventId,
    name: args.displayName,
    session_token: args.sessionToken,
  };
}

export function participantNameUpdatePayload(displayName: string): Record<string, unknown> {
  return { name: displayName.trim() || null };
}
