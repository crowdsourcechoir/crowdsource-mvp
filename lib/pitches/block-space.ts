import type { CopyBlock } from "@/app/sobeca-song-garden/content";

/**
 * Space a description tight under its bullet, and leave a larger gap before the next bullet.
 * Heading 2 uses a caps face whose line box hangs below the letters, so the following line
 * pulls up into that leftover space.
 */
export function pitchFollowMargin(type: CopyBlock["type"], previous?: CopyBlock["type"], footer = false): string {
  if (footer && type === "paragraph") return "";
  if (type === "paragraph" && previous === "heading2") return "-mt-2 sm:-mt-3";
  if (type === "heading2" && (previous === "paragraph" || previous === "heading3")) return "mt-8 sm:mt-11";
  if (type === "heading2") return "mt-4";
  if (type === "heading3" && previous === "heading2") return "mt-1";
  if (type === "paragraph") return "mt-5";
  if (type === "heading3") return "mt-3";
  return "";
}
