export type PitchDraft = {
  name: string;
  prompt: string;
  slides: unknown;
};

/** Stable identity for the editor fields that save together. */
export function pitchDraftKey(draft: PitchDraft): string {
  return JSON.stringify({ name: draft.name, prompt: draft.prompt, slides: draft.slides });
}

/** A save response can replace the editor only when nothing newer has been typed. */
export function shouldApplySavedDraft(latestKey: string, sentKey: string): boolean {
  return latestKey === sentKey;
}
