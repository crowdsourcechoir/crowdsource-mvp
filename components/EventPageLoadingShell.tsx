"use client";

import QuestionLoadingIndicator from "@/components/QuestionLoadingIndicator";

type Props = {
  /** Tighter layout when used inside routes that aren’t the full event marketing header */
  compact?: boolean;
};

/**
 * Same visual shell as the public event page (bg + logo) while data loads — not a blank black screen.
 */
export default function EventPageLoadingShell({ compact = false }: Props) {
  return (
    <div
      className="relative flex min-h-[100dvh] flex-col overflow-hidden text-gray-100"
      style={{ ["--crowdsource-accent" as string]: "#CFFF81" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/public-bg.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/20" aria-hidden />

      {/* Indeterminate progress */}
      <div className="relative z-10 h-1 w-full overflow-hidden bg-black/35">
        <div
          className="crowdsource-indeterminate-bar bg-[var(--crowdsource-accent)] shadow-[0_0_14px_rgba(207,255,129,0.45)]"
          aria-hidden
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-[env(safe-area-inset-bottom)] pt-10 sm:pt-14">
        <a
          href="https://crowdsourcechoir.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-fit opacity-95"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Crowdsource Choir"
            className={`w-auto ${compact ? "h-12 sm:h-14" : "h-16 sm:h-20"}`}
            fetchPriority="high"
          />
        </a>
        <div className="mt-10 flex flex-col items-center gap-4">
          <QuestionLoadingIndicator size={compact ? "md" : "lg"} />
        </div>
      </div>
    </div>
  );
}
