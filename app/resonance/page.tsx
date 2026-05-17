"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getResonanceField,
  getResonanceState,
  recordResonanceHold,
  type ResonanceField,
  type ResonanceSignalState,
} from "@/data/resonanceSignal";

const FULL_FIELD_HOLD_MS = 4200;
const POLL_MS = 850;
const RUMBLE_OPT_IN_KEY = "csc_resonance_iphone_rumble";
const DEVICE_ID_KEY = "csc_resonance_device_id";

type BrowserWindow = Window &
  typeof globalThis & {
    CrowdsourceChoirResonanceHaptics?: NativeHapticsBridge;
    webkit?: {
      messageHandlers?: {
        crowdsourceChoirResonanceHaptics?: {
          postMessage: (message: NativeHapticMessage) => void;
        };
      };
    };
  };

type NativeHapticEventType = "preview" | "start" | "update" | "stop";

type NativeHapticMessage = {
  channel: "resonance-haptics";
  intensity: number;
  timestamp: number;
  type: NativeHapticEventType;
};

type NativeHapticsBridge = Partial<
  Record<NativeHapticEventType, (message: NativeHapticMessage) => void>
>;

type RumbleVoice = {
  gain: GainNode;
  harmonic: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  oscillator: OscillatorNode;
};

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = `res_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function playRumblePreview(context: AudioContext) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const harmonic = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  harmonic.type = "sine";
  oscillator.frequency.setValueAtTime(96, now);
  harmonic.frequency.setValueAtTime(192, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.setTargetAtTime(0.07, now, 0.025);
  gain.gain.setTargetAtTime(0.0001, now + 0.22, 0.04);
  oscillator.connect(gain);
  harmonic.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  harmonic.start(now);
  oscillator.stop(now + 0.42);
  harmonic.stop(now + 0.42);
}

function buildNativeHapticMessage(
  type: NativeHapticEventType,
  intensity = 0
): NativeHapticMessage {
  return {
    channel: "resonance-haptics",
    intensity: Math.max(0, Math.min(intensity, 1)),
    timestamp: Date.now(),
    type,
  };
}

function hasNativeHapticBridge() {
  if (typeof window === "undefined") return false;
  const browserWindow = window as BrowserWindow;
  return Boolean(
    browserWindow.CrowdsourceChoirResonanceHaptics ||
      browserWindow.webkit?.messageHandlers?.crowdsourceChoirResonanceHaptics
  );
}

function sendNativeHapticEvent(type: NativeHapticEventType, intensity = 0) {
  if (typeof window === "undefined") return false;
  const browserWindow = window as BrowserWindow;
  const message = buildNativeHapticMessage(type, intensity);

  try {
    const directBridge = browserWindow.CrowdsourceChoirResonanceHaptics;
    const directHandler = directBridge?.[type];
    if (typeof directHandler === "function") {
      directHandler(message);
      return true;
    }

    const webkitBridge =
      browserWindow.webkit?.messageHandlers?.crowdsourceChoirResonanceHaptics;
    if (webkitBridge) {
      webkitBridge.postMessage(message);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function pulseVibration(pattern: number | number[]) {
  if (typeof navigator === "undefined") return false;
  const vibrate = navigator.vibrate;
  if (typeof vibrate !== "function") return false;
  const vibrationPattern = typeof pattern === "number" ? [pattern] : pattern;
  return vibrate.call(navigator, vibrationPattern);
}

function seconds(ms: number) {
  return (ms / 1000).toFixed(1);
}

export default function ResonanceParticipantPage() {
  const [activeField, setActiveField] = useState<ResonanceField>(() =>
    getResonanceField(null)
  );
  const [fieldSignal, setFieldSignal] = useState<ResonanceSignalState | null>(null);
  const [hasNativeHaptics, setHasNativeHaptics] = useState(false);
  const [hasVibrationApi, setHasVibrationApi] = useState(true);
  const [holdElapsed, setHoldElapsed] = useState(0);
  const [isDissolving, setIsDissolving] = useState(false);
  const [isEngaged, setIsEngaged] = useState(false);
  const [rumbleOptedIn, setRumbleOptedIn] = useState(false);
  const [totals, setTotals] = useState<Record<string, number>>({});

  const activeSignalRef = useRef<ResonanceSignalState | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const deviceIdRef = useRef("");
  const engagedRef = useRef(false);
  const holdElapsedRef = useRef(0);
  const holdStartRef = useRef<number | null>(null);
  const hasNativeHapticsRef = useRef(false);
  const hasVibrationApiRef = useRef(true);
  const lastFrameRef = useRef<number | null>(null);
  const lastNativeHapticUpdateRef = useRef(0);
  const renderFrameRef = useRef(0);
  const rumbleOptedInRef = useRef(false);
  const rumbleRef = useRef<RumbleVoice | null>(null);

  const holdPower = Math.min(holdElapsed / FULL_FIELD_HOLD_MS, 1);
  const holdScale = 1 + holdPower * 5.2;
  const holdBloom = Math.min(0.18 + holdPower * 0.82, 1);
  const holdPulseMin = holdScale * 0.985;
  const holdPulseMax = holdScale * 1.025;
  const showSoundPulseOptIn =
    !hasNativeHaptics && !hasVibrationApi && !rumbleOptedIn;

  const stopRumble = useCallback(() => {
    const context = audioContextRef.current;
    const rumble = rumbleRef.current;
    if (!context || !rumble) return;

    const now = context.currentTime;
    rumble.gain.gain.cancelScheduledValues(now);
    rumble.gain.gain.setTargetAtTime(0.0001, now, 0.03);
    rumble.oscillator.stop(now + 0.12);
    rumble.harmonic.stop(now + 0.12);
    rumble.lfo.stop(now + 0.12);
    window.setTimeout(() => {
      rumble.oscillator.disconnect();
      rumble.harmonic.disconnect();
      rumble.lfo.disconnect();
      rumble.lfoGain.disconnect();
      rumble.gain.disconnect();
    }, 180);
    rumbleRef.current = null;
  }, []);

  const startRumble = useCallback(() => {
    const context = audioContextRef.current;
    if (
      !context ||
      context.state !== "running" ||
      rumbleRef.current ||
      hasNativeHapticsRef.current ||
      hasVibrationApiRef.current ||
      !rumbleOptedInRef.current
    ) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const harmonic = context.createOscillator();
    const gain = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    oscillator.type = "triangle";
    harmonic.type = "sine";
    oscillator.frequency.setValueAtTime(88, now);
    harmonic.frequency.setValueAtTime(176, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setTargetAtTime(0.042, now, 0.035);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(18, now);
    lfoGain.gain.setValueAtTime(9, now);
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);
    lfoGain.connect(harmonic.frequency);

    oscillator.connect(gain);
    harmonic.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    harmonic.start(now);
    lfo.start(now);
    rumbleRef.current = { gain, harmonic, lfo, lfoGain, oscillator };
  }, []);

  const updateRumble = useCallback((power: number) => {
    sendNativeHapticEvent("update", power);

    const context = audioContextRef.current;
    const rumble = rumbleRef.current;
    if (!context || !rumble) return;

    const now = context.currentTime;
    const baseFrequency = 88 + power * 34;
    rumble.gain.gain.setTargetAtTime(0.038 + power * 0.09, now, 0.05);
    rumble.oscillator.frequency.setTargetAtTime(baseFrequency, now, 0.08);
    rumble.harmonic.frequency.setTargetAtTime(baseFrequency * 2, now, 0.08);
    rumble.lfo.frequency.setTargetAtTime(18 + power * 12, now, 0.08);
    rumble.lfoGain.gain.setTargetAtTime(9 + power * 16, now, 0.08);
  }, []);

  const setEngagement = useCallback(
    (engaged: boolean) => {
      engagedRef.current = engaged;
      holdStartRef.current = engaged ? performance.now() : null;
      holdElapsedRef.current = 0;
      setHoldElapsed(0);
      setIsEngaged(engaged);
      sendNativeHapticEvent(engaged ? "start" : "stop", engaged ? 0.12 : 0);
      if (engaged) {
        startRumble();
      } else {
        stopRumble();
      }
    },
    [startRumble, stopRumble]
  );

  const refreshState = useCallback(async () => {
    const next = await getResonanceState();
    const previousSignalId = activeSignalRef.current?.signalId;
    activeSignalRef.current = next;
    setFieldSignal(next);

    if (next.signalId !== previousSignalId) {
      setIsDissolving(true);
      window.setTimeout(() => {
        setActiveField(getResonanceField(next.activeFieldId));
        setIsDissolving(false);
      }, 420);
    } else {
      setActiveField(getResonanceField(next.activeFieldId));
    }
  }, []);

  useEffect(() => {
    deviceIdRef.current = getOrCreateDeviceId();

    const canUseNativeHaptics = hasNativeHapticBridge();
    hasNativeHapticsRef.current = canUseNativeHaptics;
    setHasNativeHaptics(canUseNativeHaptics);

    const canVibrate =
      typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
    hasVibrationApiRef.current = canVibrate;
    setHasVibrationApi(canVibrate);

    if (!canVibrate && !canUseNativeHaptics) {
      try {
        const saved = localStorage.getItem(RUMBLE_OPT_IN_KEY) === "1";
        rumbleOptedInRef.current = saved;
        setRumbleOptedIn(saved);
      } catch {
        rumbleOptedInRef.current = false;
        setRumbleOptedIn(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshState().catch(() => undefined);
    const interval = window.setInterval(() => {
      refreshState().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [refreshState]);

  useEffect(() => {
    let animationFrame = 0;

    const tick = (time: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = time;
      const delta = time - lastFrameRef.current;
      lastFrameRef.current = time;

      if (engagedRef.current) {
        const elapsed = holdStartRef.current === null ? 0 : time - holdStartRef.current;
        holdElapsedRef.current = elapsed;
        setHoldElapsed(elapsed);

        const power = Math.min(elapsed / FULL_FIELD_HOLD_MS, 1);
        if (time - lastNativeHapticUpdateRef.current > 90) {
          lastNativeHapticUpdateRef.current = time;
          updateRumble(power);
        }

        const fieldId = activeSignalRef.current?.activeFieldId ?? activeField.id;
        if (time - renderFrameRef.current > 90) {
          renderFrameRef.current = time;
          setTotals((prev) => ({ ...prev, [fieldId]: (prev[fieldId] ?? 0) + delta }));
        }
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeField.id, updateRumble]);

  useEffect(() => {
    if (!isEngaged || typeof navigator === "undefined") return;

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
      stopRumble();
    };
  }, [setEngagement, stopRumble]);

  const setRumbleOptIn = useCallback((enabled: boolean) => {
    rumbleOptedInRef.current = enabled;
    setRumbleOptedIn(enabled);
    try {
      localStorage.setItem(RUMBLE_OPT_IN_KEY, enabled ? "1" : "0");
    } catch {
      // The in-memory choice still works for this visit.
    }
  }, []);

  const enableSoundPulse = useCallback(async () => {
    setRumbleOptIn(true);

    const AudioContextConstructor =
      window.AudioContext || (window as Window & typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextConstructor) return;
    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    await context.resume().catch(() => undefined);
    if (context.state === "running") playRumblePreview(context);
  }, [setRumbleOptIn]);

  const engage = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    pulseVibration([22, 24, 22]);
    setEngagement(true);
  };

  const release = async (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const durationMs = holdElapsedRef.current;
    const signal = activeSignalRef.current;
    setEngagement(false);
    pulseVibration(0);

    if (signal && durationMs > 80) {
      await recordResonanceHold({
        deviceId: deviceIdRef.current,
        durationMs,
        fieldId: signal.activeFieldId,
        signalId: signal.signalId,
      }).catch(() => undefined);
    }
  };

  const totalHeld = useMemo(
    () => Object.values(totals).reduce((sum, value) => sum + value, 0),
    [totals]
  );

  const orbStyle = {
    "--orb-color": activeField.color,
    "--orb-core": activeField.core,
    "--orb-shadow": activeField.shadow,
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
    "--hold-halo-high": 1.18 + holdPower * 0.9,
    "--hold-halo-low": 1.08 + holdPower * 0.72,
    "--hold-orb-brightness": 1.25 + holdPower * 0.25,
    "--hold-orb-saturation": 1.28 + holdPower * 0.5,
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

        <p className="whisper">hold what resonates</p>

        {showSoundPulseOptIn ? (
          <button type="button" className="rumble-touch" onClick={enableSoundPulse}>
            enable sound pulse
          </button>
        ) : null}

        {!hasVibrationApi && rumbleOptedIn ? (
          <p className="rumble-on">sound pulse on</p>
        ) : null}
      </section>

      {totalHeld > 0 ? (
        <section className="trace-panel" aria-label="Internal resonance trace">
          <p className="trace-kicker">internal signal</p>
          <div className="trace-list">
            {(fieldSignal?.fields ?? [activeField]).map((field) => {
              const value = totals[field.id] ?? 0;
              return (
                <div className="trace-row" key={field.id}>
                  <span className="trace-dot" style={{ background: field.color }} />
                  <span className="trace-name">{field.label}</span>
                  <span className="trace-line">
                    <span
                      style={{
                        width:
                          totalHeld > 0
                            ? `${Math.max((value / totalHeld) * 100, 4)}%`
                            : "4%",
                      }}
                    />
                  </span>
                  <span className="trace-time">{seconds(value)}s</span>
                </div>
              );
            })}
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

        .whisper,
        .rumble-on,
        .rumble-touch {
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

        .rumble-on,
        .rumble-touch {
          bottom: max(5.4rem, calc(env(safe-area-inset-bottom) + 5.4rem));
          border-radius: 999rem;
          backdrop-filter: blur(18px);
        }

        .rumble-on {
          margin: 0;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.62rem 0.82rem;
          color: rgba(255, 255, 255, 0.46);
        }

        .rumble-touch {
          border: 1px solid color-mix(in srgb, var(--orb-core) 34%, transparent);
          background: color-mix(in srgb, var(--orb-color) 16%, rgba(255, 255, 255, 0.05));
          padding: 0.72rem 0.92rem;
          box-shadow: 0 0 2.2rem color-mix(in srgb, var(--orb-color) 18%, transparent);
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
          margin: 0 0 0.85rem;
          color: rgba(255, 255, 255, 0.46);
          font-size: 0.68rem;
          letter-spacing: 0.24em;
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
