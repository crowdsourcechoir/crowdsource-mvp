"use client";

import { useEffect, useRef } from "react";
import type { SoundFrame } from "@/lib/song-garden-lab/sound";

type VoiceNodes = {
  osc: OscillatorNode;
  partial: OscillatorNode;
  gain: GainNode;
  partialGain: GainNode;
};

/**
 * Plays a SoundFrame. The frame is the fold. This graph does not keep its own garden.
 */
export default function SoundBed({ enabled, frame }: { enabled: boolean; frame: SoundFrame }) {
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    if (!enabled) return;
    const Ctx = window.AudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const nodes = new Map<string, VoiceNodes>();
    let stopped = false;

    const ensure = (id: string): VoiceNodes => {
      const existing = nodes.get(id);
      if (existing) return existing;
      const gain = ctx.createGain();
      const partialGain = ctx.createGain();
      gain.gain.value = 0;
      partialGain.gain.value = 0;
      gain.connect(master);
      partialGain.connect(master);
      const osc = ctx.createOscillator();
      const partial = ctx.createOscillator();
      osc.type = "sine";
      partial.type = "sine";
      osc.connect(gain);
      partial.connect(partialGain);
      osc.start();
      partial.start();
      const created = { osc, partial, gain, partialGain };
      nodes.set(id, created);
      return created;
    };

    const follow = window.setInterval(() => {
      if (stopped) return;
      const now = ctx.currentTime;
      const current = frameRef.current;
      const live = new Set(current.voices.map((voice) => voice.id));
      Array.from(nodes.keys()).forEach((id) => {
        if (live.has(id)) return;
        const node = nodes.get(id);
        if (!node) return;
        node.gain.gain.setTargetAtTime(0, now, 0.03);
        node.partialGain.gain.setTargetAtTime(0, now, 0.03);
        node.osc.stop(now + 0.2);
        node.partial.stop(now + 0.2);
        nodes.delete(id);
      });
      for (const voice of current.voices) {
        const node = ensure(voice.id);
        const trem = 0.72 + 0.28 * Math.sin(now * current.tempoHz * Math.PI * 2 + voice.phase);
        node.osc.frequency.setTargetAtTime(Math.max(20, voice.hz), now, 0.05);
        node.partial.frequency.setTargetAtTime(Math.max(20, voice.hz * 2), now, 0.05);
        node.gain.gain.setTargetAtTime(Math.max(0, voice.gain * trem), now, 0.05);
        node.partialGain.gain.setTargetAtTime(Math.max(0, voice.gain * voice.partial * 0.35 * trem), now, 0.05);
      }
    }, 50);

    void ctx.resume();

    return () => {
      stopped = true;
      window.clearInterval(follow);
      nodes.forEach((node) => {
        node.osc.stop();
        node.partial.stop();
      });
      void ctx.close();
    };
  }, [enabled]);

  return null;
}
