/**
 * Full-viewport loading state. Black shell and the lime line across the top.
 * Route changes use this instead of the public event photo.
 */
export default function EventPageLoadingShell() {
  return (
    <div
      className="relative min-h-[100dvh] bg-black"
      style={{ backgroundColor: "var(--csc-shell-bg, #000000)" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-1 overflow-hidden bg-black/40"
        aria-hidden
      >
        <div className="crowdsource-indeterminate-bar bg-[var(--csc-accent,#cfff81)] shadow-[0_0_14px_rgba(207,255,129,0.45)]" />
      </div>
    </div>
  );
}
