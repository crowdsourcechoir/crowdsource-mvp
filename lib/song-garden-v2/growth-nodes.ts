/**
 * Persistent "world growth" — every accepted contribution leaves a lasting mark in
 * the world instead of just a transient celebration. Nodes accumulate across the
 * whole session (and across reloads, via localStorage) so the participant can see
 * the space they've personally filled in.
 */

export type WorldGrowthNodeKind = "text" | "voice" | "video" | "percussion" | "vocal" | "other";

export type WorldGrowthNode = {
  id: string;
  kind: WorldGrowthNodeKind;
  /** Insertion order — drives the phyllotaxis layout so growth reads as organic, not random. */
  index: number;
  createdAt: number;
  /** Shared garden field vs this participant's marks. Defaults to personal (local V2). */
  emphasis?: "personal" | "shared";
};

function storageKey(eventId: string): string {
  return `cs_world_growth_${eventId}`;
}

export function loadGrowthNodes(eventId: string): WorldGrowthNode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorldGrowthNode[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendGrowthNode(
  eventId: string,
  kind: WorldGrowthNodeKind
): WorldGrowthNode[] {
  const existing = loadGrowthNodes(eventId);
  const node: WorldGrowthNode = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    index: existing.length,
    createdAt: Date.now(),
  };
  const next = [...existing, node];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(eventId), JSON.stringify(next));
    } catch {
      // ignore quota errors — growth layer is presentation-only, safe to drop
    }
  }
  return next;
}

export function clearGrowthNodes(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(eventId));
  } catch {
    // ignore
  }
}

const GOLDEN_ANGLE_DEG = 137.50776;

/**
 * Phyllotaxis (sunflower-seed spiral) layout — the same growth pattern real plants
 * use. Nodes fan out from the center of the whole world (not just one corner), so
 * contributions read as filling the *entire* garden — above, beside, and below the
 * interaction card — instead of piling up in one spot. The vertical stretch (1.35x)
 * biases the spiral toward the taller dimension of a typical portrait phone screen.
 */
export function growthNodePosition(index: number): { xPct: number; yPct: number } {
  const angle = (index * GOLDEN_ANGLE_DEG * Math.PI) / 180;
  const radius = Math.min(48, 9 + Math.sqrt(index + 1) * 7.2);
  const xPct = 50 + radius * Math.cos(angle);
  const yPct = 50 + radius * 1.35 * Math.sin(angle);
  return {
    xPct: Math.max(3, Math.min(97, xPct)),
    // Keep clear of the top title / progress / ambient ticker chrome.
    yPct: Math.max(14, Math.min(96, yPct)),
  };
}
