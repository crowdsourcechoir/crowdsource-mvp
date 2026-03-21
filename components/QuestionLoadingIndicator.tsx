"use client";

type Props = {
  /** Optional line next to the spinner (default: spinner only). */
  label?: string;
  /** Larger variant for the public event glass layout */
  size?: "md" | "lg";
};

/**
 * Spinner while the next agent question loads (not tiny ellipsis).
 */
export default function QuestionLoadingIndicator({ label, size = "md" }: Props) {
  const ring =
    size === "lg"
      ? "h-10 w-10 border-[3px] border-solid"
      : "h-7 w-7 border-2 border-solid";
  const text = size === "lg" ? "text-base text-gray-300" : "text-sm text-gray-400";

  return (
    <span
      className={`inline-flex items-center ${label ? "gap-3" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ? undefined : "Loading"}
    >
      <span
        className={`inline-block shrink-0 rounded-full border-gray-600/35 border-t-[var(--crowdsource-accent)] border-r-[var(--crowdsource-accent)]/30 animate-spin ${ring}`}
        style={{ animationDuration: "0.65s" }}
        aria-hidden
      />
      {label ? <span className={`font-medium ${text}`}>{label}</span> : null}
    </span>
  );
}
