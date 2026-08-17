import type { Event } from "@/data/mockEvents";
import type { SonggardenClip } from "@/lib/songgarden/types";
import { songgardenCategoryLabel } from "@/lib/songgarden/categories";
import {
  promptAllowsAudioRecording,
  resolveJourneySteps,
  resolveSoundStep,
} from "@/lib/songgarden/journey-steps";

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function looksLikePrompt(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length >= 18) return true;
  return trimmed.length >= 8 && /\s/.test(trimmed);
}

/**
 * Best-effort source prompt for a clip: stored label if it already is the prompt,
 * otherwise match the bloom's journey sound step (pad / RECORD button).
 */
export function resolveClipSourcePrompt(
  clip: SonggardenClip,
  event: Event | null | undefined,
  siblings: SonggardenClip[] = []
): string {
  const label = clip.label?.trim() || "";
  if (label && looksLikePrompt(label)) return label;

  const soundSteps = resolveJourneySteps(event).flatMap((step) => {
    if (step.kind !== "prompt" || !promptAllowsAudioRecording(step)) return [];
    const sound = resolveSoundStep(step);
    return sound ? [sound] : [];
  });

  const needle = normalizeName(label);
  const matchingSteps = soundSteps.filter((sound) => {
    const names = [
      sound.slot.label,
      sound.buttonLabel,
      sound.slot.id,
      ...(sound.alternateSlots ?? []).map((s) => s.label),
    ].map(normalizeName);
    return needle ? names.includes(needle) : false;
  });

  if (matchingSteps.length === 1) return matchingSteps[0].prompt.trim();

  if (matchingSteps.length > 1) {
    const sameLabel = siblings
      .filter((c) => normalizeName(c.label) === needle)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const idx = sameLabel.findIndex((c) => c.id === clip.id);
    const step = matchingSteps[idx] ?? matchingSteps[matchingSteps.length - 1];
    if (step?.prompt.trim()) return step.prompt.trim();
  }

  if (!needle && soundSteps.length === 1) return soundSteps[0].prompt.trim();

  return label || songgardenCategoryLabel(clip.category);
}

export function formatClipDuration(ms: number | null | undefined, fallbackSec?: number | null): string {
  const sec =
    ms != null && Number.isFinite(ms) && ms >= 0
      ? ms / 1000
      : fallbackSec != null && Number.isFinite(fallbackSec) && fallbackSec > 0
        ? fallbackSec
        : null;
  if (sec == null) return "—";
  if (sec < 60) return `${sec.toFixed(1).replace(/\.0$/, "")}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
