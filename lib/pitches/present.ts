export type PresentMode = "off" | "fullscreen" | "immersive";

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => void;
  webkitRequestFullScreen?: () => void;
};

export function currentFullscreenElement(): Element | null {
  const doc = document as FullscreenDoc;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** True when the deck (or the page wrapping it) owns the browser fullscreen session. */
export function isDeckFullscreen(root: HTMLElement): boolean {
  const active = currentFullscreenElement();
  if (!active) return false;
  return active === root || active === document.documentElement || root.contains(active);
}

export function fullscreenAvailable(root: HTMLElement): boolean {
  const el = root as FullscreenEl;
  return (
    typeof root.requestFullscreen === "function" ||
    typeof el.webkitRequestFullscreen === "function" ||
    typeof el.webkitRequestFullScreen === "function" ||
    typeof document.documentElement.requestFullscreen === "function"
  );
}

async function requestOn(target: HTMLElement): Promise<void> {
  const vendor = target as FullscreenEl;
  if (typeof target.requestFullscreen === "function") {
    await target.requestFullscreen({ navigationUI: "hide" });
    return;
  }
  if (typeof vendor.webkitRequestFullscreen === "function") {
    vendor.webkitRequestFullscreen();
    return;
  }
  if (typeof vendor.webkitRequestFullScreen === "function") {
    vendor.webkitRequestFullScreen();
    return;
  }
  throw new Error("Fullscreen is not available on this element.");
}

/** Prefer the deck root; fall back to the document element when the root refuses. */
export async function requestDeckFullscreen(root: HTMLElement): Promise<void> {
  const targets = [root, document.documentElement];
  let lastError: unknown;
  for (const target of targets) {
    try {
      await requestOn(target);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Fullscreen is not available in this browser.");
}

export async function exitDeckFullscreen(): Promise<void> {
  if (!currentFullscreenElement()) return;
  const doc = document as FullscreenDoc;
  if (typeof document.exitFullscreen === "function") {
    await document.exitFullscreen();
    return;
  }
  doc.webkitExitFullscreen?.();
}

/** Phones and tablets: soft immersive is the reliable path when native fullscreen is missing. */
export function prefersImmersiveFallback(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
}

/**
 * Soft present when native fullscreen is unavailable or rejected.
 * Always enters immersive so Play works on a phone (no F11 dead end).
 */
export function presentFallback(options: { coarsePointer: boolean }): {
  mode: "immersive";
  note: string | null;
} {
  return {
    mode: "immersive",
    note: options.coarsePointer
      ? "Swipe up once to tuck the address bar, then share this screen."
      : "Browser chrome stayed. Share this window, or press F11 for a fuller view.",
  };
}

/** Nudge mobile browsers to collapse chrome after entering immersive mode. */
export function nudgeMobileChrome(): void {
  if (typeof window === "undefined") return;
  const y = window.scrollY || window.pageYOffset || 0;
  window.scrollTo(0, y + 1);
  window.setTimeout(() => window.scrollTo(0, y), 50);
}
