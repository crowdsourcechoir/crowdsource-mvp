import { live } from "./live";
import type { Laws, Organism, Point } from "./types";

export type DrawHit = { id: string; x: number; y: number };

const ACCENT = "#cfff81";
const GROUND = "#050506";

function swayPoints(points: Point[], root: Point, angle: number, reach: number): Point[] {
  return points.map((point) => {
    const height = point.y - root.y;
    const t = reach > 0 ? Math.max(0, height / reach) : 0;
    const a = angle * t;
    const dx = point.x - root.x;
    const dy = point.y - root.y;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      x: root.x + dx * cos - dy * sin,
      y: root.y + dx * sin + dy * cos,
    };
  });
}

function clipRibbon(spine: Point[], widths: number[], grow: number): { spine: Point[]; widths: number[] } {
  if (spine.length < 2 || grow <= 0) {
    return { spine: spine.slice(0, 1), widths: widths.slice(0, 1) };
  }
  const exact = Math.min(1, grow) * (spine.length - 1);
  const iLast = Math.min(spine.length - 1, Math.floor(exact));
  const frac = exact - iLast;
  const nextSpine = spine.slice(0, iLast + 1);
  const nextWidths = widths.slice(0, iLast + 1);
  if (iLast < spine.length - 1 && frac > 0.001) {
    const a = spine[iLast];
    const b = spine[iLast + 1];
    nextSpine.push({ x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac });
    nextWidths.push(widths[iLast] + (widths[iLast + 1] - widths[iLast]) * frac);
  }
  return { spine: nextSpine, widths: nextWidths };
}

function outline(spine: Point[], widths: number[]): Point[] {
  if (spine.length < 2) return [];
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < spine.length; i++) {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = widths[i] / 2;
    left.push({ x: spine[i].x + -dy * w, y: spine[i].y + dx * w });
    right.push({ x: spine[i].x - -dy * w, y: spine[i].y - dx * w });
  }
  return [...left, ...right.reverse()];
}

function toCanvas(point: Point, rootX: number, rootY: number, scale: number): Point {
  return { x: rootX + point.x * scale, y: rootY - point.y * scale };
}

function trace(ctx: CanvasRenderingContext2D, points: Point[], rootX: number, rootY: number, scale: number) {
  const first = toCanvas(points[0], rootX, rootY, scale);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const point = toCanvas(points[i], rootX, rootY, scale);
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

function paintRibbon(
  ctx: CanvasRenderingContext2D,
  spine: Point[],
  widths: number[],
  rootX: number,
  rootY: number,
  scale: number,
  alpha: number
) {
  const shape = outline(spine, widths);
  if (shape.length < 3) return;
  ctx.beginPath();
  trace(ctx, shape, rootX, rootY, scale);
  ctx.fillStyle = `rgba(207, 255, 129, ${alpha})`;
  ctx.fill();
  ctx.beginPath();
  const a = toCanvas(spine[0], rootX, rootY, scale);
  ctx.moveTo(a.x, a.y);
  for (let i = 1; i < spine.length; i++) {
    const point = toCanvas(spine[i], rootX, rootY, scale);
    ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = `rgba(207, 255, 129, ${Math.min(1, alpha + 0.2)})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawOrganism(
  ctx: CanvasRenderingContext2D,
  organism: Organism,
  rootX: number,
  rootY: number,
  scale: number,
  time: number,
  grow: number,
  laws: Laws,
  selected: boolean,
  remnant = false
) {
  const behavior = live(organism, organism.birthConditions, [], laws);
  const sway = remnant ? 0 : Math.sin((time / organism.motion.periodSec) * Math.PI * 2 + organism.motion.phase) * behavior.swayAmplitude;
  const shownGrow = remnant ? 1 : grow;
  const reach = organism.ribbon.spine[organism.ribbon.spine.length - 1].y;
  const spine = swayPoints(organism.ribbon.spine, organism.ribbon.spine[0], sway, reach);
  const body = clipRibbon(spine, organism.ribbon.widths, shownGrow);
  const alpha = remnant ? (selected ? 0.28 : 0.14) : selected ? 0.95 : 0.72;
  paintRibbon(ctx, body.spine, body.widths, rootX, rootY, scale, alpha);

  if (organism.ribbon.arm && organism.ribbon.armWidths && shownGrow >= organism.ribbon.armStart) {
    const armGrow = (shownGrow - organism.ribbon.armStart) / Math.max(0.001, 1 - organism.ribbon.armStart);
    const swayedArm = swayPoints(organism.ribbon.arm, organism.ribbon.spine[0], sway, reach);
    const arm = clipRibbon(swayedArm, organism.ribbon.armWidths, armGrow);
    paintRibbon(ctx, arm.spine, arm.widths, rootX, rootY, scale, alpha * 0.9);
  }

  if (selected) {
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(rootX, rootY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (laws.showLabels && shownGrow > 0.85) {
    ctx.fillStyle = remnant ? "rgba(207, 255, 129, 0.35)" : selected ? ACCENT : "rgba(207, 255, 129, 0.55)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(organism.id, rootX, rootY + 16);
  }
}

function paintField(
  ctx: CanvasRenderingContext2D,
  organisms: Organism[],
  bounds: { x: number; y: number; width: number; height: number },
  options: {
    time: number;
    grow: number;
    laws: Laws;
    selectedId: string | null;
    label?: string;
    remnants?: Organism[];
  }
): DrawHit[] {
  const { x, y, width, height } = bounds;
  const groundY = y + height * 0.78;
  const gradient = ctx.createLinearGradient(0, groundY - 40, 0, y + height);
  gradient.addColorStop(0, "rgba(207, 255, 129, 0)");
  gradient.addColorStop(1, "rgba(207, 255, 129, 0.06)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, groundY, width, y + height - groundY);
  ctx.strokeStyle = "rgba(207, 255, 129, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x + width, groundY);
  ctx.stroke();

  if (options.label) {
    ctx.fillStyle = "rgba(207, 255, 129, 0.8)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(options.label, x + width - 16, y + 28);
  }

  const scale = Math.min(width, height) * 0.52;
  const hits: DrawHit[] = [];
  for (const organism of options.remnants ?? []) {
    const rootX = x + organism.position.x * width;
    const rootY = groundY;
    const selected = organism.id === options.selectedId;
    drawOrganism(ctx, organism, rootX, rootY, scale, options.time, options.grow, options.laws, selected, true);
    hits.push({ id: organism.id, x: rootX, y: rootY });
  }
  for (const organism of organisms) {
    const rootX = x + organism.position.x * width;
    const rootY = groundY;
    const selected = organism.id === options.selectedId;
    drawOrganism(ctx, organism, rootX, rootY, scale, options.time, options.grow, options.laws, selected);
    hits.push({ id: organism.id, x: rootX, y: rootY });
  }
  return hits;
}

export function drawGarden(
  ctx: CanvasRenderingContext2D,
  organisms: Organism[],
  options: {
    width: number;
    height: number;
    time: number;
    grow: number;
    laws: Laws;
    selectedId: string | null;
    layout: "field" | "sheet";
    marks?: { x: number; text: string }[];
    remnants?: Organism[];
  }
): DrawHit[] {
  const { width, height, layout, laws } = options;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, width, height);

  const hits: DrawHit[] = [];
  if (layout === "sheet") {
    const cols = 6;
    const rows = Math.max(1, Math.ceil(organisms.length / cols));
    const cellW = width / cols;
    const cellH = height / rows;
    organisms.forEach((organism, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const rootX = col * cellW + cellW / 2;
      const rootY = row * cellH + cellH * 0.72;
      ctx.strokeStyle = "rgba(207, 255, 129, 0.18)";
      ctx.beginPath();
      ctx.moveTo(col * cellW + 10, rootY);
      ctx.lineTo((col + 1) * cellW - 10, rootY);
      ctx.stroke();
      const selected = organism.id === options.selectedId;
      drawOrganism(ctx, organism, rootX, rootY, cellH * 0.62, options.time, options.grow, laws, selected);
      hits.push({ id: organism.id, x: rootX, y: rootY });
    });
    return hits;
  }

  hits.push(
    ...paintField(ctx, organisms, { x: 0, y: 0, width, height }, {
      time: options.time,
      grow: options.grow,
      laws,
      selectedId: options.selectedId,
      remnants: options.remnants,
    })
  );
  if (options.marks?.length) {
    ctx.fillStyle = "rgba(207, 255, 129, 0.8)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const mark of options.marks) {
      ctx.fillText(mark.text, mark.x * width, 28);
    }
  }
  return hits;
}

/** World A above World B. The same genome id highlights in both. */
export function drawCompare(
  ctx: CanvasRenderingContext2D,
  worlds: { label: string; organisms: Organism[] }[],
  options: {
    width: number;
    height: number;
    time: number;
    grow: number;
    laws: Laws;
    selectedId: string | null;
  }
): DrawHit[] {
  const { width, height } = options;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, width, height);
  const band = height / Math.max(1, worlds.length);
  const hits: DrawHit[] = [];
  worlds.forEach((world, index) => {
    const y = index * band;
    if (index > 0) {
      ctx.strokeStyle = "rgba(207, 255, 129, 0.18)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    hits.push(
      ...paintField(ctx, world.organisms, { x: 0, y, width, height: band }, {
        time: options.time,
        grow: options.grow,
        laws: options.laws,
        selectedId: options.selectedId,
        label: world.label,
      })
    );
  });
  return hits;
}
