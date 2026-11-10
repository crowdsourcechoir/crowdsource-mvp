/** The magenta midtone of the built-in salmon grade. */
export const SALMON_OVERLAY_COLOR = "#E6579E";

const SALMON_STOPS = {
  r: "0.48 0.90 1",
  g: "0.12 0.34 0.84",
  b: "0.32 0.62 0.52",
};

export function overlayColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const color = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color) || color === SALMON_OVERLAY_COLOR) return undefined;
  return color;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function mix(color: [number, number, number], toward: [number, number, number], amount: number): [number, number, number] {
  return [
    color[0] + (toward[0] - color[0]) * amount,
    color[1] + (toward[1] - color[1]) * amount,
    color[2] + (toward[2] - color[2]) * amount,
  ];
}

function channels(shadow: [number, number, number], mid: [number, number, number], highlight: [number, number, number]) {
  const line = (index: 0 | 1 | 2) =>
    [shadow[index], mid[index], highlight[index]].map((value) => value.toFixed(2)).join(" ");
  return { r: line(0), g: line(1), b: line(2) };
}

/** Shadow, midtone, and highlight stops. The default salmon color keeps its gold highlights. */
export function overlayTable(color?: string): { r: string; g: string; b: string } {
  const hex = (color ?? SALMON_OVERLAY_COLOR).toUpperCase();
  if (hex === SALMON_OVERLAY_COLOR) return SALMON_STOPS;
  const mid = hexToRgb(hex);
  const shadow = mix(mid, [0, 0, 0], 0.55);
  const highlight = mix(mid, [1, 1, 1], 0.68);
  return channels(shadow, mid, highlight);
}
