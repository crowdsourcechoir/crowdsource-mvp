/**
 * Route loading state for the Song Garden pitch.
 * The root app/loading.tsx paints the Crowdsource Choir event shell
 * (pink public-bg.png). This route stays black so the pitch does not
 * flash that other page before its own black shell arrives.
 */
export default function SobecaSongGardenLoading() {
  return (
    <div
      className="min-h-[100dvh] bg-black"
      style={{ backgroundColor: "#000000" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    />
  );
}
