/** Play a reference tone for choir pads (scale degrees 1, 4, 5, 6 in C). */

const ROOT_HZ = 130.81; // C3

function hzForDegree(degree: 1 | 4 | 5 | 6): number {
  const semitones: Record<1 | 4 | 5 | 6, number> = { 1: 0, 4: 5, 5: 7, 6: 9 };
  return ROOT_HZ * Math.pow(2, semitones[degree] / 12);
}

export async function playReferenceTone(degree: 1 | 4 | 5 | 6, durationMs = 3000): Promise<void> {
  if (typeof window === "undefined") return;

  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = hzForDegree(degree);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.05);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + durationMs / 1000 - 0.12);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);

  await new Promise((resolve) => window.setTimeout(resolve, durationMs + 80));
  await ctx.close().catch(() => undefined);
}
