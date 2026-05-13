"use client";

/**
 * Fixed top progress strip (same motion as public event loading), styled for admin (blue).
 */
export default function AdminIndeterminateProgress() {
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-1 overflow-hidden bg-black/40"
      role="progressbar"
      aria-hidden
    >
      <div className="crowdsource-indeterminate-bar bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.55)]" />
    </div>
  );
}
