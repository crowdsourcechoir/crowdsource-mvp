"use client";

export type PadState =
  | "idle"
  | "active"
  | "countdown"
  | "recording"
  | "captured"
  | "review"
  | "uploading"
  | "done"
  | "error";

type PadButtonProps = {
  label: string;
  state: PadState;
  onClick: () => void;
  onStopRecording?: () => void;
  onPreview?: () => void;
  onRetry?: () => void;
  onKeep?: () => void;
  onPlayTone?: () => void;
  previewPlaying?: boolean;
  disabled?: boolean;
  large?: boolean;
  fullWidth?: boolean;
  countdown?: number | null;
  recordSecondsLeft?: number | null;
  recordProgress?: number | null;
  audioLevel?: number | null;
  silenceWarning?: boolean;
  recordingHint?: string;
  /** Full-width button styling matching lyric recording CTAs */
  journeyStyle?: boolean;
};

const reviewActionClass =
  "min-h-[44px] border border-[var(--crowdsource-accent)] bg-[#2d1f42] px-2 py-2.5 font-mono text-[11px] text-[var(--crowdsource-accent)] transition hover:bg-[var(--crowdsource-accent)] hover:text-[#1a1530] active:scale-[0.98] disabled:opacity-50 sm:min-h-[32px] sm:px-1 sm:py-1.5 sm:text-[9px]";

const reviewKeepClass =
  "min-h-[44px] border border-[var(--crowdsource-accent)] bg-[var(--crowdsource-accent)] px-2 py-2.5 font-mono text-[11px] text-[#1a1530] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50 sm:min-h-[32px] sm:px-1 sm:py-1.5 sm:text-[9px]";

const journeyReviewShellClass =
  "crowdsource-journey-surface relative flex w-full min-h-[108px] flex-col items-center px-4 py-3 font-mono text-[var(--crowdsource-accent)]";

const journeyAccentText = "text-[var(--crowdsource-accent,#CFFF81)]";

const journeyHintText = "mt-1 text-[10px] tracking-normal text-[var(--crowdsource-accent,#CFFF81)]";

function LevelBars({ level }: { level: number }) {
  return (
    <div className="flex h-4 items-end justify-center gap-0.5" aria-hidden>
      {[0.2, 0.4, 0.6, 0.8, 1].map((threshold, i) => (
        <span
          key={i}
          className={`w-1 rounded-sm transition-all duration-75 ${
            level >= threshold ? "bg-red-400" : "bg-white/15"
          }`}
          style={{ height: `${8 + i * 3}px` }}
        />
      ))}
    </div>
  );
}

export default function PadButton({
  label,
  state,
  onClick,
  onStopRecording,
  onPreview,
  onRetry,
  onKeep,
  onPlayTone,
  previewPlaying,
  disabled,
  large,
  fullWidth,
  countdown,
  recordSecondsLeft,
  recordProgress,
  audioLevel,
  silenceWarning,
  recordingHint = "● rec",
  journeyStyle,
}: PadButtonProps) {
  const isDone = state === "done";
  const isRecording = state === "recording";
  const canStopRecording = isRecording && !!onStopRecording;
  const isActive =
    state === "active" ||
    state === "countdown" ||
    isRecording ||
    state === "captured" ||
    state === "review" ||
    state === "uploading";
  const inCountdown = state === "countdown" && countdown != null;
  const inRecording = isRecording && recordSecondsLeft != null;
  const progress = recordProgress ?? 0;
  const level = audioLevel ?? 0;
  const hintText = recordingHint.replace(/^●\s*/, "");

  const journeyShellBase = `crowdsource-btn relative flex w-full flex-col items-center justify-center px-6 py-4 sm:min-h-[64px] ${
    fullWidth ? "w-full" : ""
  }`;

  const shellClass = journeyStyle
    ? `${journeyShellBase} ${
        state === "idle"
          ? "crowdsource-btn-outline"
          : "crowdsource-journey-surface text-[var(--crowdsource-accent)]"
      }`
    : `relative flex min-h-[72px] flex-col items-center justify-center border px-3 py-4 font-mono text-sm font-medium tracking-[0.15em] transition sm:min-h-[80px] ${
        large ? "sm:min-h-[88px]" : ""
      } ${fullWidth ? "col-span-2 w-full" : ""}`;

  if (state === "review") {
    return (
      <div
        className={
          journeyStyle
            ? journeyReviewShellClass
            : `${shellClass} min-h-[108px] border-[var(--crowdsource-accent)]/60 bg-[var(--crowdsource-accent)]/10 py-3 text-[var(--crowdsource-accent)]`
        }
      >
        <span
          className={
            journeyStyle
              ? `${journeyAccentText} text-[1.0625rem] leading-snug sm:text-lg`
              : "text-[10px] tracking-[0.2em]"
          }
        >
          {label}
        </span>
        <div className="mt-2 grid w-full grid-cols-2 gap-2 sm:gap-1.5">
          {onPlayTone ? (
            <>
              <button
                type="button"
                disabled={previewPlaying}
                onClick={onPreview}
                className={reviewActionClass}
              >
                {previewPlaying ? "▶ …" : "▶ LISTEN"}
              </button>
              <button
                type="button"
                disabled={previewPlaying}
                onClick={onPlayTone}
                className={reviewActionClass}
              >
                ♪ TONE
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={previewPlaying}
              onClick={onPreview}
              className={`${reviewActionClass} col-span-2`}
            >
              {previewPlaying ? "▶ …" : "▶ LISTEN"}
            </button>
          )}
          <button type="button" disabled={previewPlaying} onClick={onRetry} className={reviewActionClass}>
            ↻ AGAIN
          </button>
          <button type="button" disabled={previewPlaying} onClick={onKeep} className={reviewKeepClass}>
            ✓ KEEP
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={
        disabled ||
        state === "uploading" ||
        state === "countdown" ||
        state === "captured" ||
        (isRecording && !canStopRecording)
      }
      onClick={canStopRecording ? onStopRecording : onClick}
      className={`${shellClass} ${
        isDone
          ? journeyStyle
            ? "border-[var(--crowdsource-accent)] bg-[var(--crowdsource-accent)]/15 text-[var(--crowdsource-accent)] hover:bg-[var(--crowdsource-accent)] hover:text-[#1a1530]"
            : "border-[#CFFF81] bg-[#CFFF81]/25 text-[#CFFF81] shadow-[0_0_32px_rgba(207,255,129,0.45)] hover:bg-[#CFFF81]/35 active:scale-[0.98]"
            : isRecording
              ? canStopRecording
                ? "cursor-pointer border-red-400 bg-red-950/70 text-red-50 shadow-[0_0_28px_rgba(248,113,113,0.35)] songgarden-rec-pulse hover:border-red-300 hover:bg-red-900/80 hover:text-white active:scale-[0.98]"
                : "border-red-400 bg-red-950/70 text-red-50 shadow-[0_0_28px_rgba(248,113,113,0.35)] songgarden-rec-pulse"
            : isActive
              ? journeyStyle
                ? "crowdsource-journey-surface border-[var(--crowdsource-accent)]/60 text-[var(--crowdsource-accent,#CFFF81)]"
                : "border-[var(--crowdsource-accent)] bg-[var(--crowdsource-accent)]/15 text-[var(--crowdsource-accent)] shadow-[0_0_20px_rgba(207,255,129,0.2)]"
              : state === "error"
                ? "border-red-400/50 bg-red-400/10 text-red-200"
                : journeyStyle
                  ? ""
                  : "border-white/25 bg-white/5 text-gray-100 hover:border-white/45 hover:bg-white/10 active:scale-[0.98]"
      } disabled:cursor-default disabled:opacity-90`}
    >
      {isDone && (
        <span className="absolute right-2 top-2 text-base font-bold text-[#CFFF81]" aria-hidden>
          ✓
        </span>
      )}
      {inCountdown ? (
        <>
          <span className={`text-3xl font-medium tabular-nums leading-none ${journeyAccentText}`}>{countdown}</span>
          <span className={journeyHintText}>get ready…</span>
        </>
      ) : state === "captured" ? (
        <>
          <span className={`text-lg font-medium tracking-[0.12em] ${journeyStyle ? journeyAccentText : ""}`}>GOT IT</span>
          <span className={journeyStyle ? journeyHintText : "mt-1 text-[10px] tracking-normal text-gray-300"}>nice</span>
        </>
      ) : inRecording ? (
        <div className="flex w-full flex-col items-center gap-1.5 px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-80" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold tracking-[0.25em] text-red-300">REC</span>
          </div>
          <LevelBars level={level} />
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-red-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          {silenceWarning ? (
            <span className="text-center text-[9px] leading-tight tracking-normal text-amber-300">
              We&apos;re not hearing you — move closer or check your mic
            </span>
          ) : (
            <span className="text-[10px] tracking-normal text-red-200">
              {recordSecondsLeft}s · {hintText}
            </span>
          )}
          {canStopRecording && (
            <span className="text-[9px] font-normal tracking-normal text-red-200/90">tap to stop</span>
          )}
        </div>
      ) : (
        <>
          <span className={journeyStyle ? "text-inherit" : undefined}>{label}</span>
          {isDone && (
            <span className={journeyStyle ? `${journeyHintText} text-inherit` : "mt-1 text-[9px] font-normal tracking-normal text-[#CFFF81]/90"}>
              tap to redo
            </span>
          )}
        </>
      )}
      {state === "active" && (
        <span className={`${journeyHintText} text-inherit`}>listen to tone</span>
      )}
      {state === "uploading" && (
        <span className={journeyStyle ? journeyHintText : "mt-1 text-[10px] tracking-normal text-gray-300"}>adding…</span>
      )}
    </button>
  );
}
