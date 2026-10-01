import type { Expressed, Genome, Laws, Point, Ribbon } from "./types";

const SPINE_COUNT = 18;
const ARM_COUNT = 8;

/**
 * Rooted ribbon in unit space, y up, root at the origin.
 * Curvature is integrated, so the bend is one decision, not a stack of wiggles.
 */
export function realizeRibbon(genome: Genome, expressed: Expressed, laws: Laws): Ribbon {
  const side: 1 | -1 = genome.articulation + genome.brightness >= genome.stillness + genome.force ? 1 : -1;
  const lean = (genome.articulation - 0.5) * expressed.asymmetry;
  const length = (0.22 + 0.58 * expressed.scale) * laws.lengthScale;
  const kappa = expressed.curvature * laws.curvatureScale * 2.2 * side;
  const forceMass = genome.force <= 0.75 ? genome.force : 0.75 + (genome.force - 0.75) * 0.35;
  const baseW = (0.014 + 0.048 * forceMass) * laws.widthScale * (1.2 - 0.5 * expressed.fineness);
  const tipW = baseW * (0.1 + 0.28 * (1 - expressed.fineness)) * (0.4 + 0.6 * genome.sustain);

  const spine: Point[] = [];
  const widths: number[] = [];
  let x = 0;
  let y = 0;
  let heading = Math.PI / 2 + lean * 0.85;
  const ds = length / (SPINE_COUNT - 1);
  for (let i = 0; i < SPINE_COUNT; i++) {
    const t = i / (SPINE_COUNT - 1);
    spine.push({ x, y });
    widths.push(baseW + (tipW - baseW) * Math.pow(t, 1.35));
    heading += kappa * (0.35 + 0.65 * t) * ds;
    x += Math.cos(heading) * ds;
    y += Math.sin(heading) * ds;
  }

  if (!expressed.secondaryArm) {
    return { spine, widths, arm: null, armWidths: null, armStart: 0 };
  }

  const armStart = 0.42 + 0.12 * (1 - genome.articulation);
  const idx = Math.min(SPINE_COUNT - 2, Math.max(1, Math.round(armStart * (SPINE_COUNT - 1))));
  const origin = spine[idx];
  const prev = spine[idx - 1];
  const parentHeading = Math.atan2(origin.y - prev.y, origin.x - prev.x);
  const armLen = length * 0.4 * laws.armLength;
  const arm: Point[] = [];
  const armWidths: number[] = [];
  let ax = origin.x;
  let ay = origin.y;
  let ah = parentHeading + side * 0.9;
  const ads = armLen / (ARM_COUNT - 1);
  const armK = kappa * 0.65 * -side;
  for (let i = 0; i < ARM_COUNT; i++) {
    const t = i / (ARM_COUNT - 1);
    arm.push({ x: ax, y: ay });
    armWidths.push(Math.max(0.004, widths[idx] * (0.62 - 0.45 * t)));
    ah += armK * ads;
    ax += Math.cos(ah) * ads;
    ay += Math.sin(ah) * ads;
  }
  return { spine, widths, arm, armWidths, armStart };
}
