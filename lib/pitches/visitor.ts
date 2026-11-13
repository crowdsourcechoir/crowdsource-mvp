export type PitchVisitorView = "deck" | "password" | "unavailable";

/**
 * What an unsigned visitor gets at a pitch URL.
 * A saved password is the front door, including when the pitch is hidden.
 * "This page is not live" is only a hidden pitch with no password.
 * A signed-in owner can still open that unpublished pitch.
 * A matching password opens the deck.
 */
export function pitchVisitorView(input: {
  live: boolean;
  hasPassword: boolean;
  owner: boolean;
  unlocked: boolean;
}): PitchVisitorView {
  if (input.hasPassword && !input.unlocked) return "password";
  if (!input.live && !input.owner && !input.unlocked) return "unavailable";
  return "deck";
}
