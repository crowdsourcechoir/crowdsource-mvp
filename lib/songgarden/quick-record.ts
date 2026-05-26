/** Capture a short mic clip with optional level + progress callbacks. */

export type RecordProgress = {
  remainingMs: number;
  totalMs: number;
  /** Normalized mic level 0–1 */
  level: number;
};

export type QuickRecordHandle = {
  promise: Promise<Blob>;
  stop: () => void;
};

const MIN_RECORD_MS = 280;

export type QuickRecordOptions = {
  /** Reuse a stream acquired during countdown so recording starts immediately. */
  stream?: MediaStream;
  /** Fires synchronously when MediaRecorder.start() runs — use for the go beep. */
  onRecordingStarted?: () => void;
};

export function startQuickRecord(
  durationMs: number,
  onProgress?: (progress: RecordProgress) => void,
  options?: QuickRecordOptions
): QuickRecordHandle {
  let recorder: MediaRecorder | null = null;
  let tick: number | null = null;
  let timeout: number | null = null;
  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let stopped = false;
  let startedAt = 0;

  const cleanup = () => {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void audioContext?.close();
    audioContext = null;
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const promise = (async () => {
    stream = options?.stream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));

    const recorderOptions: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      recorderOptions.mimeType = "audio/webm;codecs=opus";
    }
    recorder = new MediaRecorder(stream, recorderOptions);
    const chunks: Blob[] = [];

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const levelBuffer = new Uint8Array(analyser.frequencyBinCount);

    startedAt = Date.now();
    const emit = () => {
      analyser.getByteFrequencyData(levelBuffer);
      let sum = 0;
      for (let i = 0; i < levelBuffer.length; i++) sum += levelBuffer[i];
      const avg = sum / levelBuffer.length / 255;
      const level = Math.min(1, avg * 2.2);
      const elapsed = Date.now() - startedAt;
      onProgress?.({
        remainingMs: Math.max(0, durationMs - elapsed),
        totalMs: durationMs,
        level,
      });
    };

    emit();
    tick = window.setInterval(emit, 80);

    return await new Promise<Blob>((resolve, reject) => {
      if (!recorder) {
        reject(new Error("Recording failed"));
        return;
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => reject(new Error("Recording failed"));
      recorder.onstop = () => {
        cleanup();
        onProgress?.({ remainingMs: 0, totalMs: durationMs, level: 0 });
        const elapsed = Date.now() - startedAt;
        const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
        if (blob.size === 0 || elapsed < MIN_RECORD_MS) {
          reject(new Error("Too short — hold a little longer, then tap to stop."));
          return;
        }
        resolve(blob);
      };

      recorder.start();
      options?.onRecordingStarted?.();
      timeout = window.setTimeout(stop, durationMs);
    });
  })().catch((err) => {
    cleanup();
    throw err;
  });

  return { promise, stop };
}

export async function quickRecord(
  durationMs: number,
  onProgress?: (progress: RecordProgress) => void
): Promise<Blob> {
  const { promise } = startQuickRecord(durationMs, onProgress);
  return promise;
}

/** Short beep when the mic opens — signals "go" after the 3-2-1. */
export function playRecordStartCue(): void {
  try {
    const ctx = new AudioContext();
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime;
    osc.start(start);
    osc.stop(start + 0.1);
    osc.onended = () => void ctx.close();
  } catch {
    // Optional cue — ignore if blocked
  }
}

/** Acquire mic access early so countdown → record feels instant. */
export function prefetchMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function playAudioBlob(
  blob: Blob,
  holder?: { current: HTMLAudioElement | null }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    if (holder) holder.current = audio;
    audio.onended = () => {
      if (holder) holder.current = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      if (holder) holder.current = null;
      URL.revokeObjectURL(url);
      reject(new Error("Playback failed"));
    };
    void audio.play().catch(reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function flashCaptured(): Promise<void> {
  await sleep(450);
}
