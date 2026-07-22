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
export function useAmbientTilt(maxOffsetPx = 14): { x: MotionValue<number>; y: MotionValue<number> } {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const idleRef = useRef<{ x?: ReturnType<typeof animate>; y?: ReturnType<typeof animate> }>({});

  useEffect(() => {
    let liveInputActive = false;

    function stopIdle() {
      idleRef.current.x?.stop();
      idleRef.current.y?.stop();
    }

    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.beta == null || e.gamma == null) return;
      liveInputActive = true;
      stopIdle();
      const gamma = Math.max(-22, Math.min(22, e.gamma));
      const beta = Math.max(-22, Math.min(22, e.beta - 45));
      animate(x, (gamma / 22) * maxOffsetPx, { duration: 0.7, ease: "easeOut" });
      animate(y, (beta / 22) * maxOffsetPx, { duration: 0.7, ease: "easeOut" });
    }

    function handleMouseMove(e: MouseEvent) {
      if (liveInputActive) return;
      stopIdle();
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      animate(x, nx * maxOffsetPx, { duration: 0.5, ease: "easeOut" });
      animate(y, ny * maxOffsetPx, { duration: 0.5, ease: "easeOut" });
    }

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("mousemove", handleMouseMove);

    idleRef.current.x = animate(x, [0, maxOffsetPx * 0.4, 0, -maxOffsetPx * 0.4, 0], {
      duration: 22,
      repeat: Infinity,
      ease: "easeInOut",
    });
    idleRef.current.y = animate(y, [0, -maxOffsetPx * 0.3, 0, maxOffsetPx * 0.3, 0], {
      duration: 27,
      repeat: Infinity,
      ease: "easeInOut",
    });

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("mousemove", handleMouseMove);
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
