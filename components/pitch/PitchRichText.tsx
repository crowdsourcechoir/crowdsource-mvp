"use client";

import type { PitchPoint } from "@/app/sobeca-song-garden/content";
import { BRUSH_COLOR, parseCopyRuns, pitchPoint, type CopyRun } from "@/lib/pitches/copy-format";

export function PitchRichText({
  text,
  bold,
  underline,
}: {
  text: string;
  bold?: string[];
  underline?: true | string | false;
}) {
  const runs = parseCopyRuns(text, { bold, underline });
  const whole = underline === true && !runs.some((run) => run.underline);
  const body = runs.map((run, index) => <RichRun key={`${index}-${run.text}`} run={run} />);
  if (whole) return <BrushSpan>{body}</BrushSpan>;
  return <>{body}</>;
}

function RichRun({ run }: { run: CopyRun }) {
  let node: React.ReactNode = run.text;
  if (run.bold) node = <strong className="font-bold">{node}</strong>;
  if (run.underline) node = <BrushSpan>{node}</BrushSpan>;
  return <>{node}</>;
}

function BrushSpan({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline">
      {children}
      <svg
        viewBox="0 0 200 28"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute -left-[1%] top-[0.78em] h-[0.2em] w-[102%] overflow-visible"
      >
        <path
          className="pitch-brush"
          pathLength={1}
          d="M2 17C26 23 54 11 100 16C146 21 168 11 198 14"
          fill="none"
          stroke={BRUSH_COLOR}
          strokeWidth="9"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function PitchPointList({ items }: { items: Array<string | PitchPoint> }) {
  const structured = items.some((item) => pitchPoint(item));
  return (
    <ul className={`mt-6 max-w-3xl ${structured ? "space-y-5 sm:space-y-6" : "space-y-2 text-base leading-relaxed sm:text-lg"}`}>
      {items.map((item, index) => {
        const point = pitchPoint(item);
        const plain = typeof item === "string" ? item : `${item.label}${item.detail ? ` ${item.detail}` : ""}`;
        return (
          <li key={index} className="border-l-2 border-[#CFFF81] pl-4">
            {point ? (
              <>
                <p className="text-xl font-bold leading-tight sm:text-2xl">
                  <PitchRichText text={point.label} />
                </p>
                {point.detail ? (
                  <p className="mt-1 text-sm leading-relaxed opacity-90 sm:text-base">
                    <PitchRichText text={point.detail} />
                  </p>
                ) : null}
              </>
            ) : (
              <PitchRichText text={plain} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
