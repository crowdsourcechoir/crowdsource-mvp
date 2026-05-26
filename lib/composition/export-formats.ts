import type { CompositionBrief } from "@/lib/composition/types";

export function briefToMarkdown(brief: CompositionBrief): string {
  const lines: string[] = [
    "# Composition Brief",
    "",
    `Generated: ${new Date(brief.generatedAt).toLocaleString()}`,
  ];

  if (brief.eventId) lines.push(`Event: ${brief.eventId}`);
  if (brief.sessionIds.length > 0) lines.push(`Sessions: ${brief.sessionIds.join(", ")}`);
  lines.push("");

  lines.push("## Creative Summary", "", brief.creativeSummary || "—", "");

  if (brief.emotionalArc) {
    lines.push("## Emotional Arc", "", brief.emotionalArc, "");
  }

  if (brief.lyricThemes.length > 0) {
    lines.push("## Lyric Themes", "");
    for (const theme of brief.lyricThemes) {
      lines.push(`### ${theme.label}`, "");
      for (const example of theme.exampleLines) {
        lines.push(`- ${example}`);
      }
      lines.push("");
    }
  }

  if (brief.strongestPhrases.length > 0) {
    lines.push("## Strongest Phrases", "");
    for (const phrase of brief.strongestPhrases) {
      lines.push(`- ${phrase}`);
    }
    lines.push("");
  }

  if (brief.hookCandidates.length > 0) {
    lines.push("## Hook Candidates", "");
    for (const hook of brief.hookCandidates) {
      lines.push(`- ${hook}`);
    }
    lines.push("");
  }

  if (brief.chantableLines.length > 0) {
    lines.push("## Chantable Lines", "");
    for (const line of brief.chantableLines) {
      lines.push(`- ${line}`);
    }
    lines.push("");
  }

  if (brief.signalTextureNotes.length > 0) {
    lines.push("## Signal Texture Notes", "");
    for (const note of brief.signalTextureNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  if (brief.shoutouts.length > 0) {
    lines.push("## Shoutouts", "", brief.shoutouts.join(", "), "");
  }

  if (brief.sunoPrompts.length > 0) {
    lines.push("## Suno Prompts", "");
    brief.sunoPrompts.forEach((prompt, i) => {
      lines.push(`### Prompt ${i + 1}`, "", prompt, "");
    });
  }

  lines.push("## Source Counts", "");
  lines.push(`- Interview turns: ${brief.sourceCounts.interviewTurns}`);
  lines.push(`- Live submissions: ${brief.sourceCounts.liveSubmissions}`);
  lines.push(`- Signal rounds: ${brief.sourceCounts.signalRounds}`);
  lines.push(`- Phrase cards: ${brief.sourceCounts.phraseCards}`);

  return lines.join("\n");
}

export function briefToJson(brief: CompositionBrief): string {
  return JSON.stringify(brief, null, 2);
}

export function briefDownloadFilename(brief: CompositionBrief, ext: "json" | "md"): string {
  const stamp = brief.generatedAt.slice(0, 10);
  const scope = brief.eventId?.slice(0, 8) ?? brief.sessionIds[0]?.slice(0, 8) ?? "brief";
  return `composition-brief-${scope}-${stamp}.${ext}`;
}
