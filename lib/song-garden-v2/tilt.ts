"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, type MotionValue } from "framer-motion";

/**
 * The 2.5D "embodiment" cue — the background isn't flat, it has depth you can
 * look around in. Prefers real device tilt (phones held in the hand naturally
 * wobble a little); falls back to mouse position on desktop; and always has a
 * slow autonomous drift underneath so the world never looks perfectly frozen
 * even with the phone sitting still on a table.
 */
export function useAmbientTilt(maxOffsetPx = 28): { x: MotionValue<number>; y: MotionValue<number> } {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const idleRef = useRef<{ x?: ReturnType<typeof animate>; y?: ReturnType<typeof animate> }>({});
  const liveInputActive = useRef(false);
  const idleRestartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function stopIdle() {
      idleRef.current.x?.stop();
      idleRef.current.y?.stop();
      idleRef.current = {};
    }

    function startIdle() {
      stopIdle();
      liveInputActive.current = false;
      idleRef.current.x = animate(x, [0, maxOffsetPx * 0.55, 0, -maxOffsetPx * 0.55, 0], {
        duration: 14,
        repeat: Infinity,
        ease: "easeInOut",
      });
      idleRef.current.y = animate(y, [0, -maxOffsetPx * 0.4, 0, maxOffsetPx * 0.4, 0], {
        duration: 18,
        repeat: Infinity,
        ease: "easeInOut",
      });
    }

    function scheduleIdleRestart() {
      if (idleRestartTimer.current) clearTimeout(idleRestartTimer.current);
      idleRestartTimer.current = setTimeout(() => {
        if (!liveInputActive.current) startIdle();
      }, 1800);
    }

    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.beta == null || e.gamma == null) return;
      liveInputActive.current = true;
      stopIdle();
      if (idleRestartTimer.current) clearTimeout(idleRestartTimer.current);
      const gamma = Math.max(-30, Math.min(30, e.gamma));
      const beta = Math.max(-30, Math.min(30, e.beta - 45));
      animate(x, (gamma / 30) * maxOffsetPx, { duration: 0.45, ease: "easeOut" });
      animate(y, (beta / 30) * maxOffsetPx, { duration: 0.45, ease: "easeOut" });
    }

    function handleMouseMove(e: MouseEvent) {
      if (liveInputActive.current) return;
      stopIdle();
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      animate(x, nx * maxOffsetPx, { duration: 0.35, ease: "easeOut" });
      animate(y, ny * maxOffsetPx, { duration: 0.35, ease: "easeOut" });
      scheduleIdleRestart();
    }

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("mousemove", handleMouseMove);
    startIdle();

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("mousemove", handleMouseMove);
      if (idleRestartTimer.current) clearTimeout(idleRestartTimer.current);
      stopIdle();
    };
  }, [maxOffsetPx, x, y]);

  return { x, y };
}

/**
 * iOS 13+ requires an explicit user-gesture-triggered permission prompt before
 * `deviceorientation` events fire at all. Call this from the same tap that
 * starts the journey (already a user gesture) — silently no-ops everywhere
 * else (Android, desktop), where orientation just works or isn't applicable.
 */
export function requestTiltPermission(): void {
  if (typeof window === "undefined") return;
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
    .DeviceOrientationEvent;
  if (DOE?.requestPermission) {
    DOE.requestPermission().catch(() => undefined);
  }
}
