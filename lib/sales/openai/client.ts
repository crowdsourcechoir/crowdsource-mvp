import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export const DEFAULT_SALES_MODEL = "gpt-4o-mini";

/** Rough per-1M-token USD pricing for cost tracking. Update as models/pricing change. */
const MODEL_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
};

function estimateCostUsd(model: string, tokensInput: number, tokensOutput: number): number {
  const pricing = MODEL_PRICING_PER_1M[model] ?? MODEL_PRICING_PER_1M[DEFAULT_SALES_MODEL];
  return (tokensInput / 1_000_000) * pricing.input + (tokensOutput / 1_000_000) * pricing.output;
}

export type StructuredCallResult<T> = {
  parsed: T;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
};

/**
 * A single structured-output call: system prompt + user content in, Zod-validated JSON out.
 * The untrusted-content boundary (research pages, etc.) is the caller's responsibility —
 * see lib/sales/pipeline/stages/research.ts for how source text is quoted/delimited.
 */
export async function callStructured<T>(input: {
  schema: ZodType<T>;
  schemaName: string;
  systemPrompt: string;
  userContent: string;
  model?: string;
}): Promise<StructuredCallResult<T>> {
  const client = getOpenAIClient();
  const model = input.model ?? DEFAULT_SALES_MODEL;
  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userContent },
    ],
    response_format: zodResponseFormat(input.schema, input.schemaName),
  });
  const message = completion.choices[0]?.message;
  if (!message?.parsed) {
    throw new Error(`OpenAI structured output for "${input.schemaName}" did not parse: ${message?.refusal ?? "no content"}`);
  }
  const tokensInput = completion.usage?.prompt_tokens ?? 0;
  const tokensOutput = completion.usage?.completion_tokens ?? 0;
  return {
    parsed: message.parsed,
    model,
    tokensInput,
    tokensOutput,
    costUsd: estimateCostUsd(model, tokensInput, tokensOutput),
  };
}
