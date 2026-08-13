/** Persist last-seen world look per slug so reloads don't flash default purple/lime. */

const PREFIX = "cs_world_theme_";

export type CachedWorldTheme = {
  primaryColor: string;
  accentColor: string;
  /** First storyboard still (or hero) — paints loading shell like the journey world. */
  firstSceneUrl?: string | null;
};

function key(slug: string): string {
  return `${PREFIX}${slug.trim().toLowerCase()}`;
}

export function readWorldThemeCache(slug: string): CachedWorldTheme | null {
  if (typeof window === "undefined" || !slug.trim()) return null;
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWorldTheme;
    if (
      typeof parsed?.primaryColor === "string" &&
      typeof parsed?.accentColor === "string" &&
      parsed.primaryColor.trim() &&
      parsed.accentColor.trim()
    ) {
      return {
        primaryColor: parsed.primaryColor.trim(),
        accentColor: parsed.accentColor.trim(),
        firstSceneUrl:
          typeof parsed.firstSceneUrl === "string" && parsed.firstSceneUrl.trim()
            ? parsed.firstSceneUrl.trim()
            : null,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function writeWorldThemeCache(slug: string, theme: CachedWorldTheme): void {
  if (typeof window === "undefined" || !slug.trim()) return;
  try {
    sessionStorage.setItem(
      key(slug),
      JSON.stringify({
        primaryColor: theme.primaryColor.trim(),
        accentColor: theme.accentColor.trim(),
        firstSceneUrl:
          typeof theme.firstSceneUrl === "string" && theme.firstSceneUrl.trim()
            ? theme.firstSceneUrl.trim()
            : null,
      })
    );
  } catch {
    // ignore quota
  }
}

/** Prefer first storyboard still, then hero artwork. */
export function firstWorldSceneUrl(world: {
  worldStoryboard?: Array<{ sceneUrl?: string | null }>;
  heroArtworkUrl?: string | null;
}): string | null {
  const still = world.worldStoryboard?.find((f) => f.sceneUrl?.trim())?.sceneUrl?.trim();
  if (still) return still;
  const hero = world.heroArtworkUrl?.trim();
  return hero || null;
}
