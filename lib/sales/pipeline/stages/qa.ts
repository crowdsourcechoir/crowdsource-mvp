import { callStructured } from "../../openai/client";
import { QaResultSchema } from "../../openai/schemas";
import { getDraft, updateDraftQa } from "../../db/outreach";
import type { OutreachDraft } from "../../types";

export type QaStageOutput = {
  passed: boolean;
  flags: { type: string; detail: string }[];
};

const SYSTEM_PROMPT = `You are an independent reviewer checking a drafted outreach email for problems — you did NOT write it, so evaluate it critically. Flag: fabricated familiarity, unsupported/unverifiable claims, excessive flattery, long generic company description, fake personalization, references to private/sensitive information, or asserting fit without explaining why. Also flag if it looks unfinished (e.g. contains "{{" placeholder tokens).`;

export async function runQaStage(draftId: string): Promise<{ output: QaStageOutput; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  const draft = await getDraft(draftId);
  if (!draft) throw new Error(`Draft ${draftId} not found for QA.`);

  const deterministicFlags: { type: string; detail: string }[] = [];
  if (/\{\{\w+\}\}/.test(draft.aiBody) || /\{\{\w+\}\}/.test(draft.aiSubject)) {
    deterministicFlags.push({ type: "other", detail: "Unfilled template placeholder left in draft." });
  }
  if (/\[\s*\d+\s*(,\s*\d+\s*)*\]|\(\s*findings?\s+\d|\bas noted in findings?\b/i.test(draft.aiBody)) {
    deterministicFlags.push({ type: "unsupported_claim", detail: "Draft leaks internal citation markers (e.g. \"[8]\" or \"findings 7, 10\") into customer-facing text." });
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
