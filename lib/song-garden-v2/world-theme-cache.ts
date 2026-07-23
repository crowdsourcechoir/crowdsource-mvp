/** Persist last-seen world colors per slug so reloads don't flash default purple/lime. */

const PREFIX = "cs_world_theme_";

export type CachedWorldTheme = {
  primaryColor: string;
  accentColor: string;
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
      })
    );
  } catch {
    // ignore quota
  }
}
