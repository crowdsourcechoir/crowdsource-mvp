import type { CopyBlock } from "@/app/sobeca-song-garden/content";

/**
 * Keep a description with the bullet above it, and leave a larger gap before the next bullet.
 * The gap under the bullet is small, but not tight enough to touch the letters.
 */
export function pitchFollowMargin(type: CopyBlock["type"], previous?: CopyBlock["type"], footer = false): string {
  if (footer && type === "paragraph") return "";
  if (type === "paragraph" && previous === "heading2") return "mt-2 sm:mt-3";
  if (type === "heading2" && (previous === "paragraph" || previous === "heading3")) return "mt-8 sm:mt-11";
  if (type === "heading2") return "mt-4";
  if (type === "heading3" && previous === "heading2") return "mt-1";
  if (type === "paragraph") return "mt-5";
  if (type === "heading3") return "mt-3";
  return "";
}
