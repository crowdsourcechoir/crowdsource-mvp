import type { Point, Ribbon } from "./types";

function mix(hash: number, n: number): number {
  let h = hash ^ Math.imul(Math.round(n * 1e5), 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return h ^ (h >>> 16);
}

function mixPoints(hash: number, points: Point[]): number {
  let h = hash;
  for (const point of points) {
    h = mix(h, point.x);
    h = mix(h, point.y);
  }
  return h;
}

/** Stable across runs. Sway is not part of structure. */
export function ribbonHash(ribbon: Ribbon): string {
  let h = 0x811c9dc5;
  h = mixPoints(h, ribbon.spine);
  h = mixPoints(h, ribbon.arm ?? []);
  h = mix(h, ribbon.arm ? 1 : 0);
  return (h >>> 0).toString(16).padStart(8, "0");
}
