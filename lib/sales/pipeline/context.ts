import type { ResearchFinding } from "../types";

export type IndexedFindings = {
  /** 1-based index (matches how they're listed in the prompt) → finding id. */
  indexToId: Map<number, string>;
  promptText: string;
};

/** Numbers findings for a prompt so the model can cite them by index instead of fabricating IDs; we map back to real finding ids afterward. */
export function indexFindingsForPrompt(findings: (ResearchFinding & { sourceUrl?: string })[]): IndexedFindings {
  const indexToId = new Map<number, string>();
  const lines = findings.map((f, i) => {
    const index = i + 1;
    indexToId.set(index, f.id);
    const originTag = f.origin === "human_provided" ? "[human-provided, unverified]" : "[ai-researched]";
    return `${index}. ${originTag} (${f.claimType}) ${f.claimText}${f.sourceUrl ? ` — source: ${f.sourceUrl}` : ""}`;
  });
  return { indexToId, promptText: lines.length > 0 ? lines.join("\n") : "(no findings yet)" };
}

export function resolveFindingIds(indexed: IndexedFindings, indexes: number[]): string[] {
  return indexes.map((i) => indexed.indexToId.get(i)).filter((id): id is string => !!id);
}
