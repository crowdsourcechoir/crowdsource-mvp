import type { Event } from "@/data/mockEvents";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  resolveWorldConfig,
} from "@/lib/song-garden-v2/world-config";
import { firstWorldSceneUrl } from "@/lib/song-garden-v2/world-theme-cache";

export type EventPageTheme = {
  primaryColor: string;
  accentColor: string;
  firstSceneUrl: string | null;
};

export function eventPageTheme(event: Event): EventPageTheme {
  const world = resolveWorldConfig(event);
  return {
    primaryColor: world.primaryColor?.trim() || DEFAULT_PRIMARY_COLOR,
    accentColor: world.accentColor?.trim() || DEFAULT_ACCENT_COLOR,
    firstSceneUrl: firstWorldSceneUrl(world),
  };
}
