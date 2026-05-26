import OpenAI from "openai";
import { randomUUID } from "crypto";
import { gatherCompositionInputs } from "@/lib/composition/gather-inputs";
import type {
  BuildCompositionBriefOptions,
  CompositionBrief,
  CompositionGatherResult,
  CompositionLyricTheme,
} from "@/lib/composition/types";

const BRIEF_SYSTEM = `You are the Composition Layer for a live audience music experience (OCTO).

The audience is not giving data — they are giving living material. Your job is to organize raw human offerings into usable creative material for the artist (Joel). You do NOT write a finished song. You do NOT replace the artist's decisions.

Rules:
- Preserve audience language. Prefer verbatim phrases over paraphrase.
- Do not invent lyrics the audience did not say or imply.
- Group and rank; do not rewrite unless a hook candidate is a direct substring of source material.
- Chantable lines should be short (roughly 2–8 words), repeatable, and drawn from source text.
- Shoutouts: first names only, only if clearly present in source material.
- Suno prompts: 2–3 distinct production angles (genre/mood/instrumentation/vocal feel + themes from the room). Ready to paste into Suno. No markdown.
- Signal texture notes: plain-language notes about what the crowd chose sonically (from Signal resolutions). If none, return an empty array.

Respond with ONLY valid JSON (no markdown fences).`;

function parseLlmJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

function dedupeLines(lines: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function heuristicChantableCandidates(gather: CompositionGatherResult): string[] {
  const candidates: string[] = [];
  for (const line of gather.textLines) {
    const t = line.text.trim();
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8 && t.length <= 60) {
      candidates.push(t);
    }
  }
  for (const card of gather.phraseCards) {
    const t = card.rawText.trim();
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8 && t.length <= 60) {
      candidates.push(t);
    }
  }
  return dedupeLines(candidates, 24);
}

function formatSignalNotes(gather: CompositionGatherResult): string[] {
  return gather.signalResolutions.map((r) => {
    const layer = r.layer.charAt(0).toUpperCase() + r.layer.slice(1);
    return `${layer}: crowd chose "${r.label}" (${r.voteCount} votes)`;
  });
}

export function formatMaterialForPrompt(gather: CompositionGatherResult): string {
  const sections: string[] = [];

  const interviewLines = gather.textLines.filter((l) => l.source === "interview");
  const liveLines = gather.textLines.filter((l) => l.source === "live");

  if (interviewLines.length > 0) {
    sections.push(
      "=== Pre-show interview (typed) ===",
      ...interviewLines.map((l) => `- ${l.text}${l.participantLabel ? ` (${l.participantLabel})` : ""}`)
    );
  }

  if (gather.transcriptSegments.length > 0) {
    sections.push(
      "=== Pre-show interview (voice/video transcripts) ===",
      ...gather.transcriptSegments.map(
        (s) => `- [${s.mediaType}] ${s.text}${s.participantLabel ? ` (${s.participantLabel})` : ""}`
      )
    );
  }

  if (liveLines.length > 0) {
    sections.push("=== Live session text submissions ===", ...liveLines.map((l) => `- ${l.text}`));
  }

  if (gather.phraseCards.length > 0) {
    sections.push(
      "=== Crowd-validated phrase cards (with vote counts) ===",
      ...gather.phraseCards.map((c) => `- "${c.rawText}" (${c.voteCount} votes${c.locked ? ", locked" : ""})`)
    );
  }

  if (gather.signalResolutions.length > 0) {
    sections.push(
      "=== Signal layer (collective sonic choices) ===",
      ...gather.signalResolutions.map(
        (r) =>
          `- ${r.layer}: "${r.label}" won (${r.voteCount} votes) — trigger ${r.triggerId}${r.promptText ? ` — prompt: ${r.promptText}` : ""}`
      )
    );
  }

  const chantableHints = heuristicChantableCandidates(gather);
  if (chantableHints.length > 0) {
    sections.push(
      "=== Short lines that may be chantable (heuristic pre-filter) ===",
      ...chantableHints.map((l) => `- ${l}`)
    );
  }

  return sections.join("\n");
}

type LlmBriefPayload = {
  creativeSummary?: string;
  lyricThemes?: CompositionLyricTheme[];
  strongestPhrases?: string[];
  hookCandidates?: string[];
  chantableLines?: string[];
  emotionalArc?: string;
  signalTextureNotes?: string[];
  shoutouts?: string[];
  sunoPrompts?: string[];
};

function normalizeBriefPayload(
  parsed: LlmBriefPayload,
  gather: CompositionGatherResult,
  id: string,
  generatedAt: string
): CompositionBrief {
  const signalTextureNotes =
    Array.isArray(parsed.signalTextureNotes) && parsed.signalTextureNotes.length > 0
      ? parsed.signalTextureNotes.map(String)
      : formatSignalNotes(gather);

  return {
    id,
    eventId: gather.eventId,
    sessionIds: gather.sessionIds,
    generatedAt,
    creativeSummary: typeof parsed.creativeSummary === "string" ? parsed.creativeSummary.trim() : "",
    lyricThemes: Array.isArray(parsed.lyricThemes)
      ? parsed.lyricThemes
          .filter((t) => t && typeof t.label === "string")
          .map((t) => ({
            label: t.label.trim(),
            exampleLines: Array.isArray(t.exampleLines)
              ? t.exampleLines.map(String).filter(Boolean).slice(0, 6)
              : [],
          }))
          .slice(0, 10)
      : [],
    strongestPhrases: dedupeLines(Array.isArray(parsed.strongestPhrases) ? parsed.strongestPhrases.map(String) : [], 20),
    hookCandidates: dedupeLines(Array.isArray(parsed.hookCandidates) ? parsed.hookCandidates.map(String) : [], 8),
    chantableLines: dedupeLines(Array.isArray(parsed.chantableLines) ? parsed.chantableLines.map(String) : [], 12),
    emotionalArc: typeof parsed.emotionalArc === "string" ? parsed.emotionalArc.trim() : "",
    signalTextureNotes,
    shoutouts: dedupeLines(Array.isArray(parsed.shoutouts) ? parsed.shoutouts.map(String) : [], 20),
    sunoPrompts: dedupeLines(Array.isArray(parsed.sunoPrompts) ? parsed.sunoPrompts.map(String) : [], 3),
    signalResolutions: gather.signalResolutions,
    sourceCounts: gather.sourceCounts,
  };
}

function buildUserPrompt(gather: CompositionGatherResult): string {
  const material = formatMaterialForPrompt(gather);
  return `Analyze the material below and return JSON with:

1. "creativeSummary": 2–3 sentences — what the room gave, emotional center. No finished song.
2. "lyricThemes": array of { "label": string, "exampleLines": string[] } — 4–8 theme clusters with 2–4 verbatim example lines each.
3. "strongestPhrases": 10–20 strongest verbatim phrases, ranked.
4. "hookCandidates": 4–8 chorus-worthy phrases (verbatim or direct substring of source).
5. "chantableLines": 4–12 short, repeatable lines for crowd chanting (from source material).
6. "emotionalArc": 2–4 sentences tracing emotional movement (pre-show → live → signal choices if present).
7. "signalTextureNotes": plain-language production notes from Signal choices (empty array if none).
8. "shoutouts": first names only, from source (empty array if none).
9. "sunoPrompts": exactly 2–3 distinct Suno-ready prompt paragraphs.

JSON shape:
{
  "creativeSummary": "...",
  "lyricThemes": [{ "label": "...", "exampleLines": ["...", "..."] }],
  "strongestPhrases": ["..."],
  "hookCandidates": ["..."],
  "chantableLines": ["..."],
  "emotionalArc": "...",
  "signalTextureNotes": ["..."],
  "shoutouts": ["..."],
  "sunoPrompts": ["...", "..."]
}

Source material:
${material}`;
}

export function hasCompositionMaterial(gather: CompositionGatherResult): boolean {
  return (
    gather.textLines.length > 0 ||
    gather.transcriptSegments.length > 0 ||
    gather.phraseCards.length > 0 ||
    gather.signalResolutions.length > 0
  );
}

/**
 * One LLM pass: gathered Participation + Signal material → Composition Brief.
 */
export async function buildCompositionBrief(
  openai: OpenAI,
  gather: CompositionGatherResult,
  options?: { id?: string; generatedAt?: string }
): Promise<CompositionBrief> {
  if (!hasCompositionMaterial(gather)) {
    throw new Error("No composition material found for this event or session.");
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: BRIEF_SYSTEM },
      { role: "user", content: buildUserPrompt(gather) },
    ],
    max_tokens: 2048,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  let parsed: LlmBriefPayload;
  try {
    parsed = parseLlmJson<LlmBriefPayload>(raw);
  } catch {
    throw new Error("AI returned invalid JSON for Composition Brief.");
  }

  return normalizeBriefPayload(
    parsed,
    gather,
    options?.id ?? randomUUID(),
    options?.generatedAt ?? new Date().toISOString()
  );
}

/** Gather inputs and build a Composition Brief in one call. */
export async function generateCompositionBrief(
  openai: OpenAI,
  options: BuildCompositionBriefOptions
): Promise<CompositionBrief> {
  const gather = await gatherCompositionInputs(options);
  return buildCompositionBrief(openai, gather);
}
