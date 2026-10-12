"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzePcm } from "@/lib/song-garden-lab/analyze";
import {
  ROOM_PADS,
  STARTER_ID,
  choiceLabel,
  resolveTake,
  roomPad,
  scarcePad,
  type RoomChoice,
  type RoomPadId,
} from "@/lib/song-garden-lab/room";
import { loadPins, loadTakes, savePins, saveTake, type StoredTake } from "@/lib/song-garden-lab/room-store";
import { starterBlob, starterGenome } from "@/lib/song-garden-lab/starters";
import type { Genome } from "@/lib/song-garden-lab/types";

export type RoomSlot = {
  id: string;
  genome: Genome;
};

const MAX_RECORD_MS = 8000;

export default function RoomPanel({
  onSlots,
  onSelect,
}: {
  onSlots: (slots: RoomSlot[]) => void;
  onSelect: (id: string) => void;
}) {
  const [takes, setTakes] = useState<StoredTake[]>([]);
  const [pins, setPins] = useState<Partial<Record<RoomPadId, string | null>>>({});
  const [newestId, setNewestId] = useState<string | null>(null);
  const [refreshKey] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [recording, setRecording] = useState<RoomPadId | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let gone = false;
    void loadTakes()
      .then((rows) => {
        if (!gone) setTakes(rows);
      })
      .catch(() => setError("The saved takes could not be opened."));
    setPins(loadPins());
    return () => {
      gone = true;
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const choices = useMemo(() => {
    const next = {} as Record<RoomPadId, RoomChoice>;
    for (const pad of ROOM_PADS) {
      next[pad.id] = resolveTake({
        padId: pad.id,
        takes,
        pinId: pins[pad.id] ?? null,
        refreshKey,
        newestId,
      });
    }
    return next;
  }, [takes, pins, refreshKey, newestId]);

  const wanted = scarcePad(takes);

  useEffect(() => {
    onSlots(
      ROOM_PADS.map((pad) => {
        const choice = choices[pad.id];
        if (choice.id === STARTER_ID) return { id: `${pad.id}:${STARTER_ID}`, genome: starterGenome(pad.id) };
        const take = takes.find((item) => item.id === choice.id);
        return { id: `${pad.id}:${choice.id}`, genome: take?.genome ?? starterGenome(pad.id) };
      })
    );
  }, [choices, takes, onSlots]);

  function blobFor(padId: RoomPadId, choice: RoomChoice): Blob | null {
    if (choice.id === STARTER_ID) return starterBlob(padId);
    return takes.find((take) => take.id === choice.id)?.blob ?? starterBlob(padId);
  }

  async function play(padId: RoomPadId) {
    const choice = choices[padId];
    const blob = blobFor(padId, choice);
    if (!blob) return;
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlaying(padId);
    onSelect(`${padId}:${choice.id}`);
    audio.onended = () => setPlaying((current) => (current === padId ? null : current));
    try {
      await audio.play();
    } catch {
      setError("The pad could not play.");
      setPlaying(null);
    }
  }

  function pin(padId: RoomPadId) {
    const next = { ...pins, [padId]: choices[padId].id };
    setPins(next);
    savePins(next);
  }

  function unpin(padId: RoomPadId) {
    const next = { ...pins, [padId]: null };
    setPins(next);
    savePins(next);
  }

  function stopRecord() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);
    stopTimer.current = null;
    tickTimer.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(null);
  }

  async function startRecord(padId: RoomPadId) {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no microphone path.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        void keep(padId, blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(padId);
      setSeconds(0);
      const started = performance.now();
      tickTimer.current = window.setInterval(() => {
        setSeconds(Math.min(8, (performance.now() - started) / 1000));
      }, 100);
      stopTimer.current = window.setTimeout(() => stopRecord(), MAX_RECORD_MS);
    } catch {
      setError("The microphone was not available.");
    }
  }

  async function keep(padId: RoomPadId, blob: Blob) {
    setBusy(true);
    try {
      const context = new AudioContext();
      try {
        const audio = await context.decodeAudioData(await blob.arrayBuffer());
        const mono = new Float32Array(audio.length);
        for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
          const data = audio.getChannelData(channel);
          for (let i = 0; i < audio.length; i += 1) mono[i] += data[i] / audio.numberOfChannels;
        }
        const reading = analyzePcm(mono, audio.sampleRate);
        const take: StoredTake = {
          id: `room-${padId}-${Date.now()}`,
          padId,
          createdAt: Date.now(),
          genome: reading.genome,
          blob,
        };
        await saveTake(take);
        setTakes((current) => [...current, take]);
        setNewestId(take.id);
        onSelect(`${padId}:${take.id}`);
      } finally {
        await context.close();
      }
    } catch {
      setError("The recording could not be kept.");
    } finally {
      setBusy(false);
    }
  }

  const ask = roomPad(wanted);

  return (
    <section className="mb-4">
      <div className="mb-3 grid grid-cols-2 gap-2">
        {ROOM_PADS.map((pad) => {
          const choice = choices[pad.id];
          const active = playing === pad.id;
          const wantedPad = wanted === pad.id;
          return (
            <div key={pad.id} className="min-w-0">
              <button
                type="button"
                data-room-pad={pad.id}
                onClick={() => void play(pad.id)}
                className="w-full rounded-2xl border px-3 py-4 text-sm"
                style={{
                  borderColor: active || wantedPad ? "var(--csc-accent)" : "rgba(255,255,255,0.2)",
                  background: active ? "var(--csc-accent)" : "transparent",
                  color: active ? "#111" : "var(--csc-accent)",
                }}
              >
                {pad.label}
              </button>
              <p className="mt-1 flex items-center justify-between text-white/45">
                <span>{choiceLabel(choice.reason)}</span>
                {pins[pad.id] ? (
                  <button type="button" className="csc-link" onClick={() => unpin(pad.id)}>
                    Unpin
                  </button>
                ) : (
                  <button type="button" className="csc-link" onClick={() => pin(pad.id)}>
                    Pin
                  </button>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mb-2 text-white/70">{ask.prompt}</p>
      {recording ? (
        <button
          type="button"
          className="mb-3 w-full rounded-full bg-[var(--csc-accent)] px-4 py-3 text-sm text-black"
          onClick={stopRecord}
        >
          Stop {seconds.toFixed(1)}s
        </button>
      ) : (
        <button
          type="button"
          data-room-record=""
          className="mb-3 w-full rounded-full bg-[var(--csc-accent)] px-4 py-3 text-sm text-black disabled:opacity-40"
          disabled={busy}
          onClick={() => void startRecord(wanted)}
        >
          Record {ask.label.toLowerCase()}
        </button>
      )}
      {busy && <p className="mb-2 text-[var(--csc-accent)]">Reading the take…</p>}
      {error && <p className="mb-2 text-white/80">{error}</p>}
      <p className="leading-relaxed text-white/45">
        Starters are loaded, so the room can play before anyone records. A pin holds what you chose. Otherwise a refresh
        picks from what was kept. On a live event this sits behind consent, and other people can play what you keep. This
        lab does not publish to an event.
      </p>
    </section>
  );
}
