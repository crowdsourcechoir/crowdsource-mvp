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

function toCanvas(point: Point, rootX: number, rootY: number, scale: number): Point {
  return { x: rootX + point.x * scale, y: rootY - point.y * scale };
}

function paintFilament(
  ctx: CanvasRenderingContext2D,
  spine: Point[],
  widths: number[],
  rootX: number,
  rootY: number,
  scale: number,
  alpha: number
) {
  if (spine.length < 2) return;
  const points = spine.map((point) => toCanvas(point, rootX, rootY, scale));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = `rgba(207, 255, 129, ${alpha * 0.2})`;
  ctx.lineWidth = 4;
  ctx.stroke();

  for (let i = 1; i < points.length; i++) {
    const width = Math.max(1.15, (widths[i] ?? widths[widths.length - 1]) * scale * 0.28);
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = `rgba(207, 255, 129, ${alpha * 0.55})`;
    ctx.lineWidth = Math.max(1, width * 0.65);
    ctx.stroke();
  }

  const tip = points[points.length - 1];
  const tipRadius = Math.max(2, Math.min(4.5, (widths[widths.length - 1] ?? 0.02) * scale * 0.35));
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, tipRadius * 1.7, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(207, 255, 129, ${alpha * 0.2})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, tipRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(207, 255, 129, ${Math.min(1, alpha + 0.05)})`;
  ctx.fill();
}

function paintNodes(
  ctx: CanvasRenderingContext2D,
  spine: Point[],
  widths: number[],
  articulation: number,
  rootX: number,
  rootY: number,
  scale: number,
  alpha: number,
  grow: number
) {
  if (spine.length < 2 || grow <= 0) return;
  const count = 2 + Math.round(Math.max(0, Math.min(1, articulation)) * 5);
  ctx.lineWidth = 1.25;
  for (let mark = 1; mark <= count; mark++) {
    const t = mark / (count + 1);
    if (t > grow) continue;
    const exact = t * (spine.length - 1);
    const i0 = Math.min(spine.length - 1, Math.floor(exact));
    const i1 = Math.min(spine.length - 1, i0 + 1);
    const frac = exact - i0;
    const prev = spine[Math.max(0, i0 - 1)];
    const next = spine[i1];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const half = 0.028 + (widths[i0] ?? 0.02) * 1.6;
    const across = { x: -dy * half, y: dx * half };
    const mid = {
      x: spine[i0].x + (spine[i1].x - spine[i0].x) * frac,
      y: spine[i0].y + (spine[i1].y - spine[i0].y) * frac,
    };
    const a = toCanvas({ x: mid.x + across.x, y: mid.y + across.y }, rootX, rootY, scale);
    const b = toCanvas({ x: mid.x - across.x, y: mid.y - across.y }, rootX, rootY, scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(207, 255, 129, ${alpha})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
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
  remnant = false,
  skipLabel = false
) {
  const behavior = live(organism, organism.birthConditions, [], laws);
  const sway = remnant ? 0 : Math.sin((time / organism.motion.periodSec) * Math.PI * 2 + organism.motion.phase) * behavior.swayAmplitude;
  const shownGrow = remnant ? 1 : grow;
  const reach = organism.ribbon.spine[organism.ribbon.spine.length - 1].y;
  const spine = swayPoints(organism.ribbon.spine, organism.ribbon.spine[0], sway, reach);
  const body = clipRibbon(spine, organism.ribbon.widths, shownGrow);
  const alpha = remnant ? (selected ? 0.28 : 0.14) : selected ? 0.95 : 0.72;
  paintFilament(ctx, body.spine, body.widths, rootX, rootY, scale, alpha);
  paintNodes(ctx, spine, organism.ribbon.widths, organism.genome.articulation, rootX, rootY, scale, alpha, shownGrow);

  if (organism.ribbon.arm && organism.ribbon.armWidths && shownGrow >= organism.ribbon.armStart) {
    const armGrow = (shownGrow - organism.ribbon.armStart) / Math.max(0.001, 1 - organism.ribbon.armStart);
    const swayedArm = swayPoints(organism.ribbon.arm, organism.ribbon.spine[0], sway, reach);
    const arm = clipRibbon(swayedArm, organism.ribbon.armWidths, armGrow);
    paintFilament(ctx, arm.spine, arm.widths, rootX, rootY, scale, alpha * 0.72);
  }

  if (selected) {
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rootX, rootY, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(rootX, rootY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!skipLabel && laws.showLabels && shownGrow > 0.85) {
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
  const cx = x + width * 0.5;
  const cy = y + height * 0.62;
  const reach = Math.min(width, height) * 0.16;

  if (options.label) {
    ctx.fillStyle = "rgba(207, 255, 129, 0.8)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(options.label, x + width - 16, y + 28);
  }

  const scale = Math.min(width, height) * 0.4;
  const hits: DrawHit[] = [];
  const place = (organism: Organism, remnant: boolean) => {
    const angle = (organism.position.x - 0.5) * Math.PI * 1.15;
    const rootX = cx + Math.sin(angle) * reach;
    const rootY = cy - Math.cos(angle) * reach * 0.45;
    const selected = organism.id === options.selectedId;
    ctx.save();
    ctx.translate(rootX, rootY);
    ctx.rotate(angle);
    drawOrganism(ctx, organism, 0, 0, scale, options.time, options.grow, options.laws, selected, remnant, true);
    ctx.restore();
    if (options.laws.showLabels && options.grow > 0.85) {
      const lift = scale * 0.7;
      ctx.fillStyle = selected ? ACCENT : "rgba(207, 255, 129, 0.55)";
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(organism.id, rootX + Math.sin(angle) * lift, rootY - Math.cos(angle) * lift);
    }
    hits.push({ id: organism.id, x: rootX, y: rootY });
  };
  for (const organism of options.remnants ?? []) place(organism, true);
  for (const organism of organisms) place(organism, false);
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
