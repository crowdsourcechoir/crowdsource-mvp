"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ResonanceSample = {
  color: string;
  core: string;
  shadow: string;
  frequencies: number[];
  durationMs: number;
  filterHz: number;
};

const SAMPLES: ResonanceSample[] = [
  {
    color: "#9b5cff",
    core: "#ead8ff",
    shadow: "rgba(155, 92, 255, 0.38)",
    frequencies: [146.83, 220, 293.66],
    durationMs: 6800,
    filterHz: 820,
  },
  {
    color: "#15d1b3",
    core: "#cbfff6",
    shadow: "rgba(21, 209, 179, 0.36)",
    frequencies: [174.61, 261.63, 392],
    durationMs: 6800,
    filterHz: 980,
  },
  {
    color: "#ff8a3d",
    core: "#ffe0c7",
    shadow: "rgba(255, 138, 61, 0.34)",
    frequencies: [130.81, 196, 329.63],
    durationMs: 6800,
    filterHz: 720,
  },
  {
    color: "#55a7ff",
    core: "#d8ecff",
    shadow: "rgba(85, 167, 255, 0.38)",
    frequencies: [164.81, 246.94, 369.99],
    durationMs: 6800,
    filterHz: 880,
  },
];

const DISSOLVE_MS = 1100;
const RESUME_TIMEOUT_MS = 700;

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function resumeAudioContext(context: AudioContext) {
  if (context.state === "running") return true;

  const resumeAttempt = context
    .resume()
    .then(() => context.state === "running")
    .catch(() => false);

  return Promise.race([
    resumeAttempt,
    wait(RESUME_TIMEOUT_MS).then(() => context.state === "running"),
  ]);
}

function playTexture(context: AudioContext, sample: ResonanceSample) {
  const now = context.currentTime;
  const duration = sample.durationMs / 1000;
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(sample.filterHz, now);
  filter.Q.setValueAtTime(0.72, now);

  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.08, now);
  lfoGain.gain.setValueAtTime(90, now);
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.16, now + 1.4);
  master.gain.setValueAtTime(0.16, now + Math.max(duration - 1.4, 1.5));
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  sample.frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    oscillator.type = index === 1 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(index === 0 ? -4 : index === 2 ? 6 : 0, now);
    voiceGain.gain.setValueAtTime(index === 1 ? 0.42 : 0.26, now);
    oscillator.connect(voiceGain);
    voiceGain.connect(filter);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.08);
  });

  filter.connect(master);
  master.connect(context.destination);
  lfo.start(now);
  lfo.stop(now + duration + 0.08);
}

function seconds(ms: number) {
  return (ms / 1000).toFixed(1);
}

export default function ResonancePrototypePage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isDissolving, setIsDissolving] = useState(false);
  const [isEngaged, setIsEngaged] = useState(false);
  const [runState, setRunState] = useState<"ready" | "playing" | "complete">("ready");
  const [totals, setTotals] = useState<number[]>(() => SAMPLES.map(() => 0));

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeIndexRef = useRef(0);
  const dissolveRef = useRef(false);
  const engagedRef = useRef(false);
  const lastFrameRef = useRef<number | null>(null);
  const renderFrameRef = useRef(0);
  const runStateRef = useRef(runState);
  const sequenceRef = useRef(0);
  const totalsRef = useRef<number[]>(SAMPLES.map(() => 0));

  const sample = SAMPLES[activeIndex];
  const totalHeld = useMemo(() => totals.reduce((sum, value) => sum + value, 0), [totals]);

  useEffect(() => {
    runStateRef.current = runState;
  }, [runState]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    dissolveRef.current = isDissolving;
  }, [isDissolving]);

  useEffect(() => {
    engagedRef.current = isEngaged;
  }, [isEngaged]);

  useEffect(() => {
    let animationFrame = 0;

    const tick = (time: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = time;
      }

      const delta = time - lastFrameRef.current;
      lastFrameRef.current = time;

      if (
        engagedRef.current &&
        runStateRef.current === "playing" &&
        !dissolveRef.current
      ) {
        const index = activeIndexRef.current;
        totalsRef.current = totalsRef.current.map((value, valueIndex) =>
          valueIndex === index ? value + delta : value
        );

        if (time - renderFrameRef.current > 90) {
          renderFrameRef.current = time;
          setTotals([...totalsRef.current]);
        }
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (!isEngaged || typeof navigator === "undefined" || !("vibrate" in navigator)) {
      return;
    }

    navigator.vibrate?.(14);
    const interval = window.setInterval(() => {
      navigator.vibrate?.(8);
    }, 760);

    return () => window.clearInterval(interval);
  }, [isEngaged]);

  const beginExperience = useCallback(async () => {
    if (runStateRef.current === "playing") return;

    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    totalsRef.current = SAMPLES.map(() => 0);
    setTotals([...totalsRef.current]);
    setRunState("playing");
    setAudioBlocked(false);
    setIsDissolving(false);

    const AudioContextConstructor =
      window.AudioContext || (window as BrowserWindow).webkitAudioContext;

    if (!AudioContextConstructor) {
      setAudioBlocked(true);
      setRunState("ready");
      return;
    }

    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;

    const canPlay = await resumeAudioContext(context);
    if (!canPlay) {
      setAudioBlocked(true);
      setRunState("ready");
      return;
    }

    for (let index = 0; index < SAMPLES.length; index += 1) {
      if (sequenceRef.current !== sequence) return;

      activeIndexRef.current = index;
      setActiveIndex(index);
      setIsDissolving(false);
      playTexture(context, SAMPLES[index]);
      await wait(SAMPLES[index].durationMs);

      if (sequenceRef.current !== sequence) return;

      setTotals([...totalsRef.current]);
      setIsDissolving(true);
      await wait(DISSOLVE_MS);
    }

    if (sequenceRef.current !== sequence) return;

    setIsEngaged(false);
    setIsDissolving(false);
    setTotals([...totalsRef.current]);
    setRunState("complete");
  }, []);

  useEffect(() => {
    beginExperience();

    return () => {
      sequenceRef.current += 1;
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, [beginExperience]);

  const engage = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setIsEngaged(true);

    if (runStateRef.current !== "playing") {
      beginExperience();
    }
  };

  const release = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsEngaged(false);
  };

  const orbStyle = {
    "--orb-color": sample.color,
    "--orb-core": sample.core,
    "--orb-shadow": sample.shadow,
  } as React.CSSProperties;

  return (
    <main className="resonance-shell" style={orbStyle}>
      <div className="field-glow" />

      <section
        className={[
          "orb-stage",
          isEngaged ? "is-engaged" : "",
          isDissolving ? "is-dissolving" : "",
          runState === "complete" ? "is-complete" : "",
        ].join(" ")}
        aria-live="polite"
      >
        <button
          type="button"
          className="resonance-orb"
          aria-label="Hold when resonance is felt"
          onPointerDown={engage}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={() => setIsEngaged(false)}
        >
          <span className="orb-core" />
          <span className="orb-halo" />
        </button>

        {runState === "playing" && !audioBlocked ? (
          <p className="whisper">hold what resonates</p>
        ) : null}

        {audioBlocked ? (
          <button type="button" className="start-touch" onClick={beginExperience}>
            touch to begin
          </button>
        ) : null}
      </section>

      {runState === "complete" ? (
        <section className="trace-panel" aria-label="Internal resonance trace">
          <p className="trace-kicker">internal signal</p>
          <h1>resonance trace</h1>
          <div className="trace-list">
            {totals.map((value, index) => (
              <div className="trace-row" key={index}>
                <span className="trace-dot" style={{ background: SAMPLES[index].color }} />
                <span className="trace-name">field {index + 1}</span>
                <span className="trace-line">
                  <span
                    style={{
                      width:
                        totalHeld > 0 ? `${Math.max((value / totalHeld) * 100, 4)}%` : "4%",
                    }}
                  />
                </span>
                <span className="trace-time">{seconds(value)}s</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <style jsx>{`
        .resonance-shell {
          position: relative;
          display: grid;
          min-height: 100dvh;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--orb-color) 22%, transparent), transparent 32rem),
            #000;
          color: white;
          isolation: isolate;
          touch-action: none;
          user-select: none;
        }

        .field-glow {
          position: absolute;
          inset: -18%;
          z-index: -2;
          background:
            radial-gradient(circle at 50% 50%, var(--orb-shadow), transparent 26rem),
            radial-gradient(circle at 20% 14%, rgba(255, 255, 255, 0.08), transparent 18rem),
            radial-gradient(circle at 78% 86%, color-mix(in srgb, var(--orb-color) 18%, transparent), transparent 22rem);
          filter: blur(22px);
          opacity: 0.78;
          transition: background 900ms ease, opacity 900ms ease;
        }

        .orb-stage {
          position: relative;
          display: grid;
          min-height: 100dvh;
          width: min(100vw, 42rem);
          place-items: center;
          padding: 2rem;
        }

        .resonance-orb {
          position: relative;
          display: grid;
          width: clamp(12rem, 58vw, 21rem);
          aspect-ratio: 1;
          place-items: center;
          border: 0;
          border-radius: 999rem;
          background:
            radial-gradient(circle at 38% 30%, rgba(255, 255, 255, 0.96), transparent 0.8rem),
            radial-gradient(circle at 44% 38%, var(--orb-core), var(--orb-color) 34%, rgba(0, 0, 0, 0.18) 69%),
            var(--orb-color);
          box-shadow:
            0 0 2.4rem var(--orb-shadow),
            0 0 8rem color-mix(in srgb, var(--orb-color) 52%, transparent),
            inset -1.8rem -2.4rem 4rem rgba(0, 0, 0, 0.34),
            inset 1.4rem 1.8rem 3rem rgba(255, 255, 255, 0.2);
          cursor: pointer;
          outline: none;
          transform: scale(1);
          transition:
            transform 1200ms cubic-bezier(0.18, 0.9, 0.18, 1),
            filter 1200ms ease,
            opacity 900ms ease,
            box-shadow 1200ms ease,
            background 900ms ease;
          animation: orb-breathe 5200ms ease-in-out infinite;
          -webkit-tap-highlight-color: transparent;
          touch-action: none;
        }

        .resonance-orb:focus-visible {
          box-shadow:
            0 0 0 0.2rem rgba(255, 255, 255, 0.55),
            0 0 2.4rem var(--orb-shadow),
            0 0 8rem color-mix(in srgb, var(--orb-color) 52%, transparent);
        }

        .orb-core,
        .orb-halo {
          position: absolute;
          border-radius: inherit;
          pointer-events: none;
        }

        .orb-core {
          inset: 22%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.55), transparent 68%);
          filter: blur(0.35rem);
          opacity: 0.58;
        }

        .orb-halo {
          inset: -18%;
          border: 1px solid color-mix(in srgb, var(--orb-core) 40%, transparent);
          box-shadow: 0 0 5rem color-mix(in srgb, var(--orb-color) 44%, transparent);
          opacity: 0.34;
          animation: halo-drift 6600ms ease-in-out infinite;
        }

        .is-engaged .resonance-orb {
          filter: saturate(1.28) brightness(1.25);
          transform: scale(1.18);
          box-shadow:
            0 0 3.2rem color-mix(in srgb, var(--orb-core) 54%, transparent),
            0 0 10rem color-mix(in srgb, var(--orb-color) 70%, transparent),
            0 0 16rem color-mix(in srgb, var(--orb-color) 44%, transparent),
            inset -1.6rem -2.1rem 4rem rgba(0, 0, 0, 0.24),
            inset 1.4rem 1.8rem 3.4rem rgba(255, 255, 255, 0.3);
          animation: orb-held 740ms ease-in-out infinite;
        }

        .is-engaged .orb-halo {
          opacity: 0.72;
          animation: halo-held 740ms ease-in-out infinite;
        }

        .is-dissolving .resonance-orb {
          opacity: 0.18;
          filter: blur(1.2rem) saturate(0.7);
          transform: scale(0.74);
          animation: none;
        }

        .is-complete .resonance-orb {
          opacity: 0.2;
          transform: scale(0.54);
          filter: blur(0.4rem) saturate(0.75);
          animation: none;
        }

        .whisper,
        .start-touch {
          position: absolute;
          bottom: max(2rem, env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          color: rgba(255, 255, 255, 0.58);
          font-size: 0.72rem;
          letter-spacing: 0.28em;
          text-transform: lowercase;
        }

        .whisper {
          margin: 0;
          animation: whisper-fade 6200ms ease-in-out infinite;
        }

        .start-touch {
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 999rem;
          background: rgba(255, 255, 255, 0.06);
          padding: 0.8rem 1rem;
          backdrop-filter: blur(18px);
        }

        .trace-panel {
          position: absolute;
          inset: auto 1.25rem max(1.25rem, env(safe-area-inset-bottom));
          margin-inline: auto;
          width: min(calc(100vw - 2.5rem), 28rem);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.6rem;
          background: rgba(7, 7, 10, 0.58);
          padding: 1.25rem;
          box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(22px);
        }

        .trace-kicker {
          margin: 0 0 0.35rem;
          color: rgba(255, 255, 255, 0.46);
          font-size: 0.68rem;
          letter-spacing: 0.24em;
          text-transform: lowercase;
        }

        h1 {
          margin: 0 0 1.15rem;
          font-size: clamp(1.6rem, 7vw, 2.4rem);
          font-weight: 300;
          letter-spacing: -0.04em;
          text-transform: lowercase;
        }

        .trace-list {
          display: grid;
          gap: 0.82rem;
        }

        .trace-row {
          display: grid;
          grid-template-columns: auto 4.4rem minmax(0, 1fr) 3.2rem;
          align-items: center;
          gap: 0.72rem;
          color: rgba(255, 255, 255, 0.76);
          font-size: 0.82rem;
          letter-spacing: 0.02em;
        }

        .trace-dot {
          width: 0.64rem;
          aspect-ratio: 1;
          border-radius: 999rem;
          box-shadow: 0 0 1.4rem currentColor;
        }

        .trace-name,
        .trace-time {
          color: rgba(255, 255, 255, 0.62);
          text-transform: lowercase;
        }

        .trace-time {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .trace-line {
          height: 0.42rem;
          overflow: hidden;
          border-radius: 999rem;
          background: rgba(255, 255, 255, 0.08);
        }

        .trace-line span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.36), var(--orb-color));
          transition: width 900ms ease;
        }

        @keyframes orb-breathe {
          0%,
          100% {
            transform: scale(0.985);
          }
          50% {
            transform: scale(1.035);
          }
        }

        @keyframes orb-held {
          0%,
          100% {
            transform: scale(1.16);
          }
          50% {
            transform: scale(1.21);
          }
        }

        @keyframes halo-drift {
          0%,
          100% {
            transform: scale(0.96);
            opacity: 0.28;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.46;
          }
        }

        @keyframes halo-held {
          0%,
          100% {
            transform: scale(1.08);
          }
          50% {
            transform: scale(1.18);
          }
        }

        @keyframes whisper-fade {
          0%,
          100% {
            opacity: 0.32;
          }
          45% {
            opacity: 0.74;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .resonance-orb,
          .orb-halo,
          .whisper {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
