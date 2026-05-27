/** Reference tones for choir pads (scale degrees 1, 4, 5, 6 in C). */

const ROOT_HZ = 130.81; // C3

const TONE_URLS: Record<1 | 4 | 5 | 6, string> = {
  1: "/tones/degree-1.wav",
  4: "/tones/degree-4.wav",
  5: "/tones/degree-5.wav",
  6: "/tones/degree-6.wav",
};

function hzForDegree(degree: 1 | 4 | 5 | 6): number {
  const semitones: Record<1 | 4 | 5 | 6, number> = { 1: 0, 4: 5, 5: 7, 6: 9 };
  return ROOT_HZ * Math.pow(2, semitones[degree] / 12);
}

const audioByDegree = new Map<1 | 4 | 5 | 6, HTMLAudioElement>();
let audioUnlocked = false;
let webAudioContext: AudioContext | null = null;

function getToneAudio(degree: 1 | 4 | 5 | 6): HTMLAudioElement {
  let audio = audioByDegree.get(degree);
  if (!audio) {
    audio = new Audio(TONE_URLS[degree]);
    audio.preload = "auto";
    audioByDegree.set(degree, audio);
  }
  return audio;
}

function getWebAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  webAudioContext ??= new Ctx();
  return webAudioContext;
}

/** Call synchronously from a tap/click handler before any await (required on iOS Safari). */
export function unlockReferenceTones(): void {
  if (typeof window === "undefined") return;

  const audio = getToneAudio(1);
  if (!audioUnlocked) {
    audioUnlocked = true;
    audio.volume = 0.001;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
      })
      .catch(() => {
        audioUnlocked = false;
      });
  }

  const ctx = getWebAudioContext();
  if (ctx && ctx.state !== "running") {
    void ctx.resume().catch(() => undefined);
  }
}

async function playReferenceToneWebAudio(
  degree: 1 | 4 | 5 | 6,
  durationMs: number
): Promise<void> {
  const ctx = getWebAudioContext();
  if (!ctx) return;

  await ctx.resume().catch(() => undefined);
  if (ctx.state !== "running") return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = hzForDegree(degree);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.05);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + durationMs / 1000 - 0.12);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);

  await new Promise((resolve) => window.setTimeout(resolve, durationMs + 80));
}

export async function playReferenceTone(degree: 1 | 4 | 5 | 6, durationMs = 3000): Promise<void> {
  if (typeof window === "undefined") return;

  const audio = getToneAudio(degree);
  audio.volume = 1;
  audio.currentTime = 0;

  try {
    await audio.play();
  } catch {
    await playReferenceToneWebAudio(degree, durationMs);
    return;
  }

  await new Promise<void>((resolve) => {
    const finish = () => {
      audio.removeEventListener("ended", finish);
      resolve();
    };
    audio.addEventListener("ended", finish);
    window.setTimeout(finish, durationMs + 120);
  });

  audio.pause();
  audio.currentTime = 0;
}
