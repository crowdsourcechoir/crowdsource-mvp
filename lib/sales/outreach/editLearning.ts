import { listHumanEditedDrafts } from "../db/outreach";
import { stripEmailSignature } from "./signature";
import type { OutreachDraft } from "../types";

const MAX_EXAMPLE_BODY_CHARS = 900;

function meaningfulEdit(draft: OutreachDraft): boolean {
  const editedSubject = (draft.editedSubject ?? "").trim();
  const editedBody = (draft.editedBody ?? "").trim();
  if (!editedBody && !editedSubject) return false;
  const subjectChanged = editedSubject.length > 0 && editedSubject !== draft.aiSubject.trim();
  const bodyChanged = editedBody.length > 0 && editedBody !== draft.aiBody.trim();
  return subjectChanged || bodyChanged;
}

function formatExample(draft: OutreachDraft, index: number): string {
  const subject = (draft.editedSubject ?? draft.aiSubject).trim();
  const body = stripEmailSignature(draft.editedBody ?? draft.aiBody).trim();
  const clipped =
    body.length > MAX_EXAMPLE_BODY_CHARS ? `${body.slice(0, MAX_EXAMPLE_BODY_CHARS).trimEnd()}…` : body;
  return `--- HUMAN-EDITED EXAMPLE ${index} ---\nSubject: ${subject}\n\n${clipped}`;
}

/**
 * Builds few-shot voice examples from recent human draft edits so new AI fills converge toward
 * Joel's actual revisions — not just the two static reference emails in draft.ts.
 * Returns empty string when no useful edits exist yet (cold start).
 */
export async function buildHumanEditVoiceExamples(limit = 3): Promise<string> {
  const drafts = (await listHumanEditedDrafts(limit * 2)).filter(meaningfulEdit).slice(0, limit);
  if (drafts.length === 0) return "";
  const blocks = drafts.map((d, i) => formatExample(d, i + 1));
  return [
    "--- RECENT HUMAN EDITS (match this revised voice even more closely than the static examples above) ---",
    "These are real drafts Joel edited before sending. Prefer their phrasing, length, and tone when filling subject / openingReason / fitReason.",
    ...blocks,
  ].join("\n\n");
}
