import type { GardenSlotId } from "@/lib/songgarden/garden-slots";

/**
 * Participant-facing "creative moment" labels — computed from existing slot/phase
 * data, not authored separately. Keeps the admin's existing Song Garden config as
 * the single source of truth while giving V2 its own framing per the product brief
 * ("Your Words," "Your Voice," "Your World," …).
 */
export function gardenSlotMomentLabel(slotId: GardenSlotId): string {
  switch (slotId) {
    case "stomp":
    case "clap":
    case "snap":
    case "tap":
      return "Your Rhythm";
    case "low":
    case "mid":
    case "higher":
    case "highest":
      return "Your Voice";
    case "one_word":
      return "Your Word";
    case "anything_else":
      return "Your World";
    default:
      return "Your Sound";
  }
}

export const NAME_MOMENT_LABEL = "Your Name";
export const LYRIC_MOMENT_LABEL = "Your Words";
export const TRANSITION_MOMENT_LABEL = "Your World Is Ready";
export const COMPLETION_MOMENT_LABEL = "You're Part Of It";
export const WELCOME_MOMENT_LABEL = "Enter The World";
