"use client";

/**
 * Fixed top progress strip. Same lime line as the full-page loading shell.
 */
export default function AdminIndeterminateProgress() {
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-1 overflow-hidden bg-black/40"
      role="progressbar"
      aria-hidden
    >
      <div className="crowdsource-indeterminate-bar bg-[var(--csc-accent,#cfff81)] shadow-[0_0_12px_rgba(207,255,129,0.45)]" />
    </div>
  );
}
