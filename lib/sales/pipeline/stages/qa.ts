import { callStructured } from "../../openai/client";
import { QaResultSchema } from "../../openai/schemas";
import { getDraft, updateDraftQa } from "../../db/outreach";
import type { OutreachDraft } from "../../types";

export type QaStageOutput = {
  passed: boolean;
  flags: { type: string; detail: string }[];
};

const SYSTEM_PROMPT = `You are an independent reviewer checking a drafted outreach email for problems — you did NOT write it, so evaluate it critically. This email intentionally uses a warm, plain-spoken voice modeled on real emails the sender has actually sent — do NOT flag "Hi [name], I hope you're doing well!" as fabricated familiarity (it's the sender's standard, sanctioned greeting, not a claim of a prior relationship), and do NOT flag vivid language describing Crowdsource Choir's own format/pitch (e.g. "transforms attendees from spectators into participants") as "generic company description" — that's expected, confident self-description, not a claim requiring evidence.

DO flag:
- Any claim specifically about the PROSPECT organization or their event that isn't grounded in evidence
- Fabricated familiarity beyond the standard greeting (e.g. implying a prior conversation or meeting that didn't happen)
- Invented past partnerships / social proof ("successfully partnered with organizations like yours," "we've worked with groups like yours") unless the email names a real specific shared engagement
- Vague audience labels when a more specific leadership audience is obvious from context (e.g. only saying "educators" for a higher-ed leadership conference, or generic "attendees" for a municipal/city summit)
- Burying a distinctive place/theme hook (Music City, Nashville, a named conference theme) when the email mentions it only late or weakly, if the opening could have led with it
- Excessive flattery, fake personalization, private/sensitive information
- Email-cliché corporate jargon ("synergy," "leverage," "circle back," "game-changer," "fostering deep community engagement")
- Asserting fit without explaining why it fits THIS audience's actual work
- Unfinished drafts (e.g. contains "{{" placeholder tokens)`;

export async function runQaStage(draftId: string): Promise<{ output: QaStageOutput; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error(`Draft ${draftId} not found for QA.`);

  const deterministicFlags: { type: string; detail: string }[] = [];
  if (/\{\{\w+\}\}/.test(draft.aiBody) || /\{\{\w+\}\}/.test(draft.aiSubject)) {
    deterministicFlags.push({ type: "other", detail: "Unfilled template placeholder left in draft." });
  }
  if (/\[\s*\d+\s*(,\s*\d+\s*)*\]|\(\s*findings?\s+\d|\bas noted in findings?\b/i.test(draft.aiBody)) {
    deterministicFlags.push({
      type: "unsupported_claim",
      detail: "Draft leaks internal citation markers (e.g. \"[8]\" or \"findings 7, 10\") into customer-facing text.",
    });
  }
  if (
    /successfully partnered with organizations like yours|worked with (groups|organizations) like yours|partnered with (groups|organizations) like yours/i.test(
      draft.aiBody
    )
  ) {
    deterministicFlags.push({
      type: "unsupported_claim",
      detail: "Draft invents past partnership / 'organizations like yours' social proof without a named real engagement.",
    });
  }

  const result = await callStructured({
    schema: QaResultSchema,
    schemaName: "qa_result",
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Subject: ${draft.aiSubject}\n\nBody:\n${draft.aiBody}`,
  });

  const flags = [...deterministicFlags, ...result.parsed.flags];
  const passed = flags.length === 0 && result.parsed.passed;

  const status: OutreachDraft["status"] = passed ? "qa_passed" : "qa_flagged";
  await updateDraftQa(draftId, status, flags);

  return {
    output: { passed, flags },
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: result.costUsd,
  };
}
