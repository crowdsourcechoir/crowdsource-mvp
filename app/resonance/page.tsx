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
const FULL_FIELD_HOLD_MS = 4200;

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

function pulseVibration(pattern: VibratePattern) {
  if (typeof navigator === "undefined") return false;
  const vibrate = navigator.vibrate;
  if (typeof vibrate !== "function") return false;
  return vibrate.call(navigator, pattern);
}

export default function ResonancePrototypePage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [holdElapsed, setHoldElapsed] = useState(0);
  const [isDissolving, setIsDissolving] = useState(false);
  const [isEngaged, setIsEngaged] = useState(false);
  const [runState, setRunState] = useState<"ready" | "playing" | "complete">("ready");
  const [totals, setTotals] = useState<number[]>(() => SAMPLES.map(() => 0));

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeIndexRef = useRef(0);
  const dissolveRef = useRef(false);
  const engagedRef = useRef(false);
  const holdElapsedRef = useRef(0);
  const holdStartRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const pendingStartHoldRef = useRef(false);
  const pointerDownRef = useRef(false);
  const renderFrameRef = useRef(0);
  const runStateRef = useRef(runState);
  const sequenceRef = useRef(0);
  const totalsRef = useRef<number[]>(SAMPLES.map(() => 0));

  const sample = SAMPLES[activeIndex];
  const totalHeld = useMemo(() => totals.reduce((sum, value) => sum + value, 0), [totals]);
  const holdPower = Math.min(holdElapsed / FULL_FIELD_HOLD_MS, 1);
  const holdScale = 1 + holdPower * 5.2;
  const holdBloom = Math.min(0.18 + holdPower * 0.82, 1);
  const holdEnergy = Math.min(0.22 + holdPower * 0.78, 1);
  const holdPulseMin = holdScale * 0.985;
  const holdPulseMax = holdScale * 1.025;

  const setEngagement = useCallback((engaged: boolean) => {
    engagedRef.current = engaged;
    holdStartRef.current = engaged ? performance.now() : null;
    holdElapsedRef.current = 0;
    setHoldElapsed(0);
    setIsEngaged(engaged);
  }, []);

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
        const elapsed = holdStartRef.current === null ? 0 : time - holdStartRef.current;
        holdElapsedRef.current = elapsed;
        setHoldElapsed(elapsed);

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
    if (!isEngaged || typeof navigator === "undefined") {
      return;
    }

    pulseVibration([18, 28, 18]);
    const interval = window.setInterval(() => {
      const power = Math.min(holdElapsedRef.current / FULL_FIELD_HOLD_MS, 1);
      const pulse = Math.round(12 + power * 34);
      pulseVibration(power > 0.72 ? [pulse, 26, pulse] : pulse);
    }, 190);

    return () => {
      window.clearInterval(interval);
      pulseVibration(0);
    };
  }, [isEngaged]);

  useEffect(() => {
    const settle = () => {
      pointerDownRef.current = false;
      pendingStartHoldRef.current = false;
      setEngagement(false);
      pulseVibration(0);
    };
    const settleWhenHidden = () => {
      if (document.visibilityState === "hidden") settle();
    };

    window.addEventListener("pointerup", settle);
    window.addEventListener("pointercancel", settle);
    window.addEventListener("mouseup", settle);
    window.addEventListener("touchend", settle);
    window.addEventListener("touchcancel", settle);
    window.addEventListener("blur", settle);
    document.addEventListener("visibilitychange", settleWhenHidden);

    return () => {
      window.removeEventListener("pointerup", settle);
      window.removeEventListener("pointercancel", settle);
      window.removeEventListener("mouseup", settle);
      window.removeEventListener("touchend", settle);
      window.removeEventListener("touchcancel", settle);
      window.removeEventListener("blur", settle);
      document.removeEventListener("visibilitychange", settleWhenHidden);
    };
  }, [setEngagement]);

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

    if (pendingStartHoldRef.current && pointerDownRef.current) {
      setEngagement(true);
      pulseVibration([22, 24, 22]);
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

    setEngagement(false);
    setIsDissolving(false);
    setTotals([...totalsRef.current]);
    setRunState("complete");
  }, [setEngagement]);

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
    pointerDownRef.current = true;

    if (runStateRef.current !== "playing") {
      pendingStartHoldRef.current = true;
      pulseVibration([12, 28, 12]);
      beginExperience();
      setEngagement(false);
      return;
    }

    pendingStartHoldRef.current = false;
    pulseVibration([22, 24, 22]);
    setEngagement(true);
  };

  const release = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerDownRef.current = false;
    pendingStartHoldRef.current = false;
    setEngagement(false);
    pulseVibration(0);
  };

  const orbStyle = {
    "--orb-color": sample.color,
    "--orb-core": sample.core,
    "--orb-shadow": sample.shadow,
    "--current-one-duration": `${13 - holdPower * 7}s`,
    "--current-two-duration": `${15 - holdPower * 8}s`,
    "--energy-one-blur": `${1.6 - holdPower * 0.6}rem`,
    "--energy-one-end": 0.82 + holdPower * 0.46,
    "--energy-one-opacity": holdPower * 0.5,
    "--energy-one-start": 0.72 + holdPower * 0.38,
    "--energy-two-blur": `${2.2 - holdPower * 0.7}rem`,
    "--energy-two-end": 0.78 + holdPower * 0.42,
    "--energy-two-opacity": holdPower * 0.38,
    "--energy-two-start": 0.66 + holdPower * 0.32,
    "--field-glow-blur": `${22 + holdPower * 20}px`,
    "--field-glow-opacity": 0.78 + holdPower * 0.18,
    "--flood-brightness": 0.8 + holdPower * 0.45,
    "--flood-opacity": holdPower * 0.94,
    "--flood-saturation": 1 + holdPower * 0.65,
    "--flood-scale": 0.58 + holdPower * 0.72,
    "--hold-bloom": holdBloom,
    "--hold-energy": holdEnergy,
    "--hold-halo-high": 1.18 + holdPower * 0.9,
    "--hold-halo-low": 1.08 + holdPower * 0.72,
    "--hold-orb-brightness": 1.25 + holdPower * 0.25,
    "--hold-orb-saturation": 1.28 + holdPower * 0.5,
    "--hold-power": holdPower,
    "--hold-pulse-max": holdPulseMax,
    "--hold-pulse-min": holdPulseMin,
    "--hold-scale": holdScale,
    "--orb-glow-far": `${16 + holdPower * 28}rem`,
    "--orb-glow-near": `${3.2 + holdPower * 4}rem`,
    "--orb-glow-wide": `${10 + holdPower * 16}rem`,
  } as React.CSSProperties;

  return (
    <main className="resonance-shell" style={orbStyle}>
      <div className="field-glow" />
      <div className="signal-flood" />
      <div className="energy-current energy-current-one" />
      <div className="energy-current energy-current-two" />

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
          onLostPointerCapture={() => setEngagement(false)}
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
          filter: blur(var(--field-glow-blur));
          opacity: var(--field-glow-opacity);
          transition: background 900ms ease, opacity 900ms ease;
        }

        .signal-flood,
        .energy-current {
          position: fixed;
          inset: -18vmax;
          pointer-events: none;
        }

        .signal-flood {
          z-index: -1;
          background:
            radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--orb-core) 42%, transparent) 0 14%, transparent 34%),
            radial-gradient(circle at 50% 50%, var(--orb-color) 0 28%, transparent 68%),
            var(--orb-color);
          filter: saturate(var(--flood-saturation)) brightness(var(--flood-brightness));
          opacity: var(--flood-opacity);
          transform: scale(var(--flood-scale));
          transition:
            filter 220ms ease,
            opacity 900ms ease,
            transform 900ms cubic-bezier(0.18, 0.9, 0.18, 1);
        }

        .energy-current {
          z-index: 0;
          border-radius: 999rem;
          mix-blend-mode: screen;
          opacity: var(--energy-one-opacity);
          transform: scale(var(--energy-one-start));
          transition:
            opacity 700ms ease,
            transform 700ms ease;
        }

        .energy-current-one {
          background:
            conic-gradient(from 25deg, transparent, color-mix(in srgb, var(--orb-core) 34%, transparent), transparent 34%, color-mix(in srgb, var(--orb-color) 42%, transparent), transparent 72%),
            radial-gradient(circle, transparent 36%, color-mix(in srgb, var(--orb-core) 18%, transparent), transparent 66%);
          filter: blur(var(--energy-one-blur));
          animation: current-turn-one var(--current-one-duration) linear infinite;
        }

        .energy-current-two {
          background:
            conic-gradient(from 220deg, transparent, color-mix(in srgb, var(--orb-color) 36%, transparent), transparent 38%, color-mix(in srgb, white 24%, transparent), transparent 76%),
            radial-gradient(circle, transparent 28%, color-mix(in srgb, var(--orb-color) 22%, transparent), transparent 72%);
          filter: blur(var(--energy-two-blur));
          opacity: var(--energy-two-opacity);
          transform: scale(var(--energy-two-start));
          animation: current-turn-two var(--current-two-duration) linear infinite reverse;
        }

        .orb-stage {
          position: relative;
          display: grid;
          min-height: 100dvh;
          width: min(100vw, 42rem);
          place-items: center;
          padding: 2rem;
          z-index: 1;
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
          filter: saturate(var(--hold-orb-saturation)) brightness(var(--hold-orb-brightness));
          transform: scale(var(--hold-scale));
          transition:
            transform 160ms linear,
            filter 260ms ease,
            box-shadow 260ms ease,
            opacity 900ms ease,
            background 900ms ease;
          box-shadow:
            0 0 var(--orb-glow-near) color-mix(in srgb, var(--orb-core) 62%, transparent),
            0 0 var(--orb-glow-wide) color-mix(in srgb, var(--orb-color) 78%, transparent),
            0 0 var(--orb-glow-far) color-mix(in srgb, var(--orb-color) 56%, transparent),
            inset -1.6rem -2.1rem 4rem rgba(0, 0, 0, 0.24),
            inset 1.4rem 1.8rem 3.4rem rgba(255, 255, 255, 0.3);
          animation: orb-held 740ms ease-in-out infinite;
        }

        .is-engaged .orb-halo {
          opacity: var(--hold-bloom);
          box-shadow:
            0 0 var(--orb-glow-wide) color-mix(in srgb, var(--orb-color) 58%, transparent),
            inset 0 0 var(--orb-glow-near) color-mix(in srgb, var(--orb-core) 34%, transparent);
          animation: halo-held 540ms ease-in-out infinite;
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
          z-index: 2;
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
            transform: scale(var(--hold-pulse-min));
          }
          50% {
            transform: scale(var(--hold-pulse-max));
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
            transform: scale(var(--hold-halo-low));
          }
          50% {
            transform: scale(var(--hold-halo-high));
          }
        }

        @keyframes current-turn-one {
          from {
            transform: rotate(0deg) scale(var(--energy-one-start));
          }
          to {
            transform: rotate(360deg) scale(var(--energy-one-end));
          }
        }

        @keyframes current-turn-two {
          from {
            transform: rotate(0deg) scale(var(--energy-two-start));
          }
          to {
            transform: rotate(360deg) scale(var(--energy-two-end));
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
          .whisper,
          .energy-current {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
