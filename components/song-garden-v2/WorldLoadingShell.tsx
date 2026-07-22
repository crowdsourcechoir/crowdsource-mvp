"use client";

/**
 * Song Garden V2 loading shell — dark, quiet world atmosphere.
 * Deliberately NOT the public-event concert splash (public-bg.png + Crowdsource Choir logo).
 */
export default function WorldLoadingShell() {
  return (
    <div
      className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(120% 90% at 50% -10%, #2a1f3d 0%, #1a0f2d 55%, #0d0818 100%)",
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Entering the Song Garden"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 70%, rgba(207,255,129,0.12), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.35em] text-[#CFFF81]/90">
          Song Garden
        </p>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#CFFF81]"
          aria-hidden
        />
      </div>
    </div>
  );
}
