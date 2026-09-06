/**
 * Crowdsource admin design system — single source of truth for chrome tokens.
 * Settings edits persist in localStorage and apply as CSS variables on <html>.
 */

export const DESIGN_SYSTEM_STORAGE_KEY = "csc_design_system_v1";

export type DesignSystemTokens = {
  /** Lime / yellow accent used for hover outlines, links, and primary chips */
  accent: string;
  /** App shell background (true black by default) */
  shellBg: string;
  /** Resting divider between flush list rows (CSS color) */
  rowDivider: string;
  /** Vertical padding inside list rows (px) */
  rowPaddingY: number;
  /** Hover / focus outline width (px) */
  outlineWidth: number;
  /** Small circular control diameter (px) */
  circleButtonSize: number;
};

export const DEFAULT_DESIGN_TOKENS: DesignSystemTokens = {
  accent: "#CFFF81",
  shellBg: "#000000",
  rowDivider: "rgba(255, 255, 255, 0.10)",
  rowPaddingY: 16,
  outlineWidth: 1,
  circleButtonSize: 32,
};

export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

export function normalizeTokens(partial?: Partial<DesignSystemTokens> | null): DesignSystemTokens {
  const merged: DesignSystemTokens = {
    ...DEFAULT_DESIGN_TOKENS,
    ...(partial ?? {}),
  };
  if (!isHexColor(merged.accent)) merged.accent = DEFAULT_DESIGN_TOKENS.accent;
  if (!isHexColor(merged.shellBg)) merged.shellBg = DEFAULT_DESIGN_TOKENS.shellBg;
  if (typeof merged.rowPaddingY !== "number" || merged.rowPaddingY < 8 || merged.rowPaddingY > 40) {
    merged.rowPaddingY = DEFAULT_DESIGN_TOKENS.rowPaddingY;
  }
  if (typeof merged.outlineWidth !== "number" || merged.outlineWidth < 1 || merged.outlineWidth > 4) {
    merged.outlineWidth = DEFAULT_DESIGN_TOKENS.outlineWidth;
  }
  if (
    typeof merged.circleButtonSize !== "number" ||
    merged.circleButtonSize < 24 ||
    merged.circleButtonSize > 48
  ) {
    merged.circleButtonSize = DEFAULT_DESIGN_TOKENS.circleButtonSize;
  }
  if (!merged.rowDivider || typeof merged.rowDivider !== "string") {
    merged.rowDivider = DEFAULT_DESIGN_TOKENS.rowDivider;
  }
  return merged;
}

export function readStoredDesignTokens(): DesignSystemTokens {
  if (typeof window === "undefined") return DEFAULT_DESIGN_TOKENS;
  try {
    const raw = window.localStorage.getItem(DESIGN_SYSTEM_STORAGE_KEY);
    if (!raw) return DEFAULT_DESIGN_TOKENS;
    return normalizeTokens(JSON.parse(raw) as Partial<DesignSystemTokens>);
  } catch {
    return DEFAULT_DESIGN_TOKENS;
  }
}

export function writeStoredDesignTokens(tokens: DesignSystemTokens): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DESIGN_SYSTEM_STORAGE_KEY, JSON.stringify(normalizeTokens(tokens)));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Push tokens onto :root so `.csc-*` utilities and existing --crowdsource-accent consumers update. */
export function applyDesignTokensToDocument(tokens: DesignSystemTokens): void {
  if (typeof document === "undefined") return;
  const t = normalizeTokens(tokens);
  const root = document.documentElement;
  root.style.setProperty("--crowdsource-accent", t.accent);
  root.style.setProperty("--csc-accent", t.accent);
  root.style.setProperty("--csc-shell-bg", t.shellBg);
  root.style.setProperty("--csc-row-divider", t.rowDivider);
  root.style.setProperty("--csc-row-padding-y", `${t.rowPaddingY}px`);
  root.style.setProperty("--csc-outline-width", `${t.outlineWidth}px`);
  root.style.setProperty("--csc-circle-size", `${t.circleButtonSize}px`);
  root.style.setProperty("--csc-link", t.accent);
  document.body.style.backgroundColor = t.shellBg;
}

export const DESIGN_SYSTEM_EVENT = "csc:design-system-change";

export function broadcastDesignTokens(tokens: DesignSystemTokens): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_EVENT, { detail: normalizeTokens(tokens) }));
}
