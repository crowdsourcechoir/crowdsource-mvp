"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getResonanceField,
  getResonanceState,
  setResonanceField,
  type ResonanceSignalState,
} from "@/data/resonanceSignal";

export default function ResonanceAdminPage() {
  const [state, setState] = useState<ResonanceSignalState | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingFieldId, setLoadingFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setState(await getResonanceState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load signal.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const activeField = useMemo(
    () => getResonanceField(state?.activeFieldId),
    [state?.activeFieldId]
  );

  async function activate(fieldId: string) {
    setLoadingFieldId(fieldId);
    try {
      setError(null);
      setState(await setResonanceField(fieldId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send signal.");
    } finally {
      setLoadingFieldId(null);
    }
  }

  return (
    <main className="text-white">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <section>
          <p className="text-xs uppercase tracking-[0.34em] text-white/40">
            resonance signal
          </p>
          <h1 className="mt-3 text-4xl font-light tracking-[-0.05em]">
            conductor field
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
            Trigger the color field that matches the live room. Participant phones stay
            silent; touch is only a continuous resonance signal.
          </p>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-white/36">
                active field
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="h-7 w-7 rounded-full shadow-[0_0_2rem_currentColor]"
                  style={{ background: activeField.color, color: activeField.color }}
                />
                <p className="text-3xl font-light tracking-[-0.04em]">
                  {activeField.label}
                </p>
              </div>
            </div>
            <a
              className="rounded-full border border-white/14 px-4 py-3 text-sm text-white/72 transition hover:border-white/28 hover:text-white"
              href="/resonance"
              target="_blank"
              rel="noreferrer"
            >
              open participant surface
            </a>
          </div>
        </section>

        {error ? (
          <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(state?.fields ?? []).map((field) => {
            const active = field.id === state?.activeFieldId;
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => activate(field.id)}
                disabled={loadingFieldId !== null}
                className="group relative min-h-52 overflow-hidden rounded-[2rem] border border-white/10 p-5 text-left transition hover:-translate-y-0.5 hover:border-white/24 disabled:cursor-wait disabled:opacity-60"
                style={{
                  background: `radial-gradient(circle at 50% 28%, ${field.core}, ${field.color} 36%, #07070b 78%)`,
                  boxShadow: active ? `0 0 4rem ${field.shadow}` : undefined,
                }}
              >
                <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/8" />
                <span className="relative flex h-full flex-col justify-between">
                  <span className="text-xs uppercase tracking-[0.28em] text-black/50">
                    field
                  </span>
                  <span className="text-3xl font-light tracking-[-0.05em] text-black/72">
                    {field.label}
                  </span>
                  <span className="text-xs uppercase tracking-[0.24em] text-black/48">
                    {active ? "flowing" : "send"}
                  </span>
                </span>
              </button>
            );
          })}
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-white/52">
          <p>Participant link</p>
          <p className="mt-2 break-all font-mono text-white/70">
            {baseUrl ? `${baseUrl}/resonance` : "/resonance"}
          </p>
        </section>
      </div>
    </main>
  );
}
