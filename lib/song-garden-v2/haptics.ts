/**
 * The closest thing to physical feedback a screen can give — a short buzz the
 * instant a contribution lands, paired with the visual energy-field pulse.
 * No-ops silently on unsupported browsers/devices (desktop, iOS Safari).
 */
export function pulseHaptic(pattern: number | number[] = 18): void {
  if (typeof window === "undefined") return;
  try {
    window.navigator.vibrate?.(pattern);
  } catch {
    // ignore — haptics are a nice-to-have, never worth breaking the flow over
  }
}
