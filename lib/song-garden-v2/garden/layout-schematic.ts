/**
 * M2 — Layout schematic PNG for Runway reference (@layout).
 * Pure Node (zlib) — no canvas dependency.
 */

import { deflateSync } from "zlib";
import type { ZoneDef } from "@/lib/song-garden-v2/garden/types";

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return [207, 255, 129];
}

/**
 * Builds a top-down schematic: dark pitch, zone blobs at authored coords.
 * Used as a Runway layout reference so generated art respects zone placement.
 */
export function buildLayoutSchematicPng(opts: {
  zones: ZoneDef[];
  primaryColor?: string;
  accentColor?: string;
  width?: number;
  height?: number;
}): Buffer {
  const width = opts.width ?? 960;
  const height = opts.height ?? 540;
  const [pr, pg, pb] = hexToRgb(opts.primaryColor || "#0B1F3A");
  const [ar, ag, ab] = hexToRgb(opts.accentColor || "#CFFF81");

  const pixels = Buffer.alloc(width * height * 4);

  function setPixel(x: number, y: number, r: number, g: number, b: number, a = 255) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }

  // Background
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(x, y, Math.max(0, pr - 8), Math.max(0, pg - 4), Math.max(0, pb - 4));
    }
  }

  // Pitch rectangle (center field)
  const pitch = { x0: Math.floor(width * 0.22), y0: Math.floor(height * 0.28), x1: Math.floor(width * 0.78), y1: Math.floor(height * 0.78) };
  for (let y = pitch.y0; y < pitch.y1; y += 1) {
    for (let x = pitch.x0; x < pitch.x1; x += 1) {
      const edge =
        x === pitch.x0 ||
        x === pitch.x1 - 1 ||
        y === pitch.y0 ||
        y === pitch.y1 - 1 ||
        x === Math.floor((pitch.x0 + pitch.x1) / 2);
      if (edge) setPixel(x, y, ar, ag, ab, 180);
      else setPixel(x, y, Math.min(255, pr + 18), Math.min(255, pg + 28), Math.min(255, pb + 12));
    }
  }

  const zones = opts.zones.slice(0, 16);
  for (let zi = 0; zi < zones.length; zi += 1) {
    const z = zones[zi];
    const cx = Math.round(z.x * (width - 1));
    const cy = Math.round(z.y * (height - 1));
    const hit = z.hit;
    const r =
      hit?.type === "circle"
        ? Math.max(14, Math.round(hit.r * Math.min(width, height)))
        : 22;
    const tint = 0.35 + (zi % 5) * 0.1;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue;
        const fall = 1 - Math.sqrt(dx * dx + dy * dy) / (r + 0.01);
        setPixel(
          cx + dx,
          cy + dy,
          Math.round(ar * tint + 40 * fall),
          Math.round(ag * tint + 40 * fall),
          Math.round(ab * tint),
          Math.round(90 + 140 * fall)
        );
      }
    }
    // Anchor dot
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        if (dx * dx + dy * dy <= 9) setPixel(cx + dx, cy + dy, 255, 255, 255);
      }
    }
  }

  // Pack PNG
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function layoutSchematicDataUrl(opts: {
  zones: ZoneDef[];
  primaryColor?: string;
  accentColor?: string;
}): string {
  const png = buildLayoutSchematicPng(opts);
  return `data:image/png;base64,${png.toString("base64")}`;
}
