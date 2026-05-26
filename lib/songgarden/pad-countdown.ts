const COUNTDOWN_STEP_MS = 700;
const COUNTDOWN_FINAL_MS = 220;

/** Tick 3 → 2 → 1 inside the pad before recording starts. */
export async function runPadCountdown(onTick: (n: number) => void, seconds = 3): Promise<void> {
  for (let n = seconds; n >= 1; n--) {
    onTick(n);
    const waitMs = n === 1 ? COUNTDOWN_FINAL_MS : COUNTDOWN_STEP_MS;
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  }
}
