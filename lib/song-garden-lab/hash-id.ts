/** Deterministic 0..1 hash. Placement and sway phase come from here, not Math.random. */
export function hash01(id: string, salt: number): number {
  let h = 2166136261;
  const text = `${id}:${salt}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
