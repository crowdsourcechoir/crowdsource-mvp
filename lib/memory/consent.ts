import type { ConsentTaggedLine, ConsentTier, MediaRef, TranscriptRef } from "@/lib/memory/types";
import type {
  CompositionPhraseCard,
  CompositionTextLine,
  CompositionTranscriptSegment,
} from "@/lib/composition/types";

export const REUSABLE_TIERS: readonly ConsentTier[] = [
  "reuse_anonymous",
  "reuse_attributed",
  "reuse_public",
];

export function isReusableTier(tier: ConsentTier): boolean {
  return REUSABLE_TIERS.includes(tier);
}

export function tierForLivePhrase(card: CompositionPhraseCard): ConsentTier {
  if (card.locked) return "reuse_anonymous";
  return "internal_only";
}

export function tierForInterviewLine(line: CompositionTextLine): ConsentTier {
  return "internal_only";
}

export function tierForInterviewTranscript(_segment: CompositionTranscriptSegment): ConsentTier {
  return "internal_only";
}

export function tierForMediaRef(): ConsentTier {
  return "internal_only";
}

export function taggedLine(
  text: string,
  tier: ConsentTier,
  source: ConsentTaggedLine["source"],
  extra?: Partial<ConsentTaggedLine>
): ConsentTaggedLine | null {
  const t = text.trim();
  if (!t || tier === "do_not_store") return null;
  return {
    text: t,
    tier,
    source,
    ...extra,
  };
}

export function transcriptRefFromSegment(segment: CompositionTranscriptSegment): TranscriptRef {
  return {
    turnId: segment.turnId,
    conversationId: segment.conversationId,
    participantLabel: segment.participantLabel,
    mediaType: segment.mediaType,
    tier: tierForInterviewTranscript(segment),
  };
}

export function mediaRefFromTurn(
  turnId: string,
  url: string,
  mediaType: "audio" | "video"
): MediaRef {
  return {
    turnId,
    url,
    mediaType,
    tier: tierForMediaRef(),
  };
}

export function dedupeTaggedLines(lines: ConsentTaggedLine[], max: number): ConsentTaggedLine[] {
  const seen = new Set<string>();
  const out: ConsentTaggedLine[] = [];
  for (const line of lines) {
    const key = line.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

export function filterReusableExport(lines: ConsentTaggedLine[]): ConsentTaggedLine[] {
  return dedupeTaggedLines(
    lines.filter((l) => isReusableTier(l.tier)),
    48
  );
}
