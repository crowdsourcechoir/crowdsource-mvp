import OpenAI from "openai";
import { normalizeAskAboutEmailCaptcha } from "@/lib/agent-brief-email-captcha";
import {
  collectsNameFromBrief,
  resolveNameQuestionPrompt,
} from "@/lib/agent-name-question";

const MAX_TURNS = 12;
const MAX_TOKENS_RESPONSE = 256;

/** Baseline question templates; [who] is replaced with whoWhat from the brief. */
const DEFAULT_QUESTIONS = [
  (who: string) => `In one word, how would you describe ${who}?`,
  (who: string) => `What's one thing you love or admire about ${who}?`,
  (who: string) => `What's a funny or "classic ${who}" moment you've witnessed?`,
  (who: string) => `What is ${who}'s superpower?`,
  (who: string) => `What do you wish for ${who} in the next 50 years?`,
  (who: string) => `Finish this line: "${who}, you are…"`,
];

export type AgentThemeRow = {
  system_prompt_template: string;
  max_questions: number;
  do_dont_rules: unknown[];
};

export type AgentBriefRow = {
  eventName?: string;
  eventType?: string;
  whoWhat?: string;
  emotionalArc?: string;
  collectName?: boolean;
  nameQuestionPrompt?: string;
  askAbout?: string[];
  askAboutItems?: Array<{
    prompt: string;
    allowAudio?: boolean;
    allowVideo?: boolean;
    allowMedia?: boolean;
    requireEmailCaptcha?: boolean;
  }>;
  avoid?: string[];
  exampleAnswers?: string[];
} | null;

export type NextMessageInput = {
  theme: AgentThemeRow;
  brief: AgentBriefRow;
  eventTitle: string;
  conversationHistory: { role: "agent" | "user"; content: string }[];
  participantName?: string | null;
  currentStep: number;
};

export type NextMessageResult = {
  agentMessage: string;
  suggestedAnswerTypes: ("text" | "voice" | "video" | "email" | "captcha" | "short")[];
  extractedTags?: string[];
  stopReason: "continue" | "finished";
};

type ScriptedQuestion = {
  prompt: string;
  allowAudio: boolean;
  allowVideo: boolean;
  requireEmailCaptcha: boolean;
};

function getScriptedQuestions(brief: AgentBriefRow, who: string): ScriptedQuestion[] {
  const fromItems = Array.isArray(brief?.askAboutItems)
    ? brief.askAboutItems
        .map((item) => {
          const prompt = typeof item?.prompt === "string" ? item.prompt.trim() : "";
          if (!prompt) return null;
          const allowAudio = !!item.allowAudio || !!item.allowMedia;
          const allowVideo = !!item.allowVideo || !!item.allowMedia;
          return { prompt, allowAudio, allowVideo, requireEmailCaptcha: !!item.requireEmailCaptcha };
        })
        .filter((x): x is ScriptedQuestion => !!x)
    : [];

  if (fromItems.length > 0) return normalizeAskAboutEmailCaptcha(fromItems);

  const fromStrings = Array.isArray(brief?.askAbout)
    ? brief.askAbout
        .map((q) => (typeof q === "string" ? q.trim() : ""))
        .filter((q): q is string => q.length > 0)
        .map((prompt) => ({ prompt, allowAudio: false, allowVideo: false, requireEmailCaptcha: false }))
    : [];

  if (fromStrings.length > 0) return fromStrings;

  return DEFAULT_QUESTIONS.map((toQuestion) => ({
    prompt: toQuestion(who),
    allowAudio: false,
    allowVideo: false,
    requireEmailCaptcha: false,
  }));
}

function buildSystemPrompt(input: NextMessageInput): string {
  const { theme, brief, eventTitle } = input;
  let s = theme.system_prompt_template;

  s += `\n\nEvent name: ${eventTitle}`;

  if (brief) {
    if (brief.whoWhat) s += `\nWho/what it's for: ${brief.whoWhat}`;
    if (brief.emotionalArc) s += `\nDesired emotional arc: ${brief.emotionalArc}`;
    if (brief.askAbout?.length)
      s += `\nDirectives for what to ask about (guidance, not verbatim unless specified): ${brief.askAbout.join("; ")}`;
  }

  s += `\n\nRules: Ask exactly ONE short question per turn. Maximum ${theme.max_questions} questions total. Do not collect sensitive personal info.`;
  if (Array.isArray(theme.do_dont_rules) && theme.do_dont_rules.length > 0) {
    s += ` Follow: ${(theme.do_dont_rules as string[]).join(". ")}`;
  }
  s += "\n\nRespond with a JSON object only: {\"question\": \"your single question here\", \"stopReason\": \"continue\" or \"finished\"}. No other text.";
  return s;
}

export async function getNextAgentMessage(
  openai: OpenAI,
  input: NextMessageInput
): Promise<NextMessageResult> {
  const { conversationHistory, currentStep } = input;
  const brief = input.brief;
  const who = (brief?.whoWhat?.trim() && brief.whoWhat.length < 80 ? brief.whoWhat : null)
    || (input.eventTitle?.trim() && input.eventTitle.length < 80 ? input.eventTitle : null)
    || "them";

  const scriptedQuestions = getScriptedQuestions(brief, who);
  const nameSteps = collectsNameFromBrief(brief) ? 1 : 0;
  const FINISH_STEP = 1 + nameSteps + scriptedQuestions.length;

  if (currentStep >= FINISH_STEP) {
    return {
      agentMessage: "Thanks so much for sharing! That's all for now.",
      suggestedAnswerTypes: ["text"],
      stopReason: "finished",
    };
  }

  if (nameSteps === 1 && currentStep === 1) {
    return {
      agentMessage: resolveNameQuestionPrompt(brief),
      suggestedAnswerTypes: ["text"],
      stopReason: "continue",
    };
  }

  const questionIndex = currentStep - 1 - nameSteps;
  if (questionIndex >= 0 && questionIndex < scriptedQuestions.length) {
    const question = scriptedQuestions[questionIndex];
    const suggestedAnswerTypes: NextMessageResult["suggestedAnswerTypes"] = ["text"];
    if (question.allowAudio) suggestedAnswerTypes.push("voice");
    if (question.allowVideo) suggestedAnswerTypes.push("video");
    if (question.requireEmailCaptcha) {
      suggestedAnswerTypes.push("email");
      suggestedAnswerTypes.push("captcha");
    }
    return {
      agentMessage: question.prompt,
      suggestedAnswerTypes,
      stopReason: "continue",
    };
  }

  // Fallback: if still in scripted range, return the next scripted question instead of trusting LLM.
  if (currentStep >= 1 && currentStep < FINISH_STEP) {
    const idx = Math.max(0, currentStep - 1 - nameSteps);
    const q = scriptedQuestions[Math.min(idx, scriptedQuestions.length - 1)];
    const suggestedAnswerTypes: NextMessageResult["suggestedAnswerTypes"] = ["text"];
    if (q.allowAudio) suggestedAnswerTypes.push("voice");
    if (q.allowVideo) suggestedAnswerTypes.push("video");
    if (q.requireEmailCaptcha) {
      suggestedAnswerTypes.push("email");
      suggestedAnswerTypes.push("captcha");
    }
    return {
      agentMessage: q.prompt,
      suggestedAnswerTypes,
      stopReason: "continue",
    };
  }

  // Fallback: LLM for edge cases
  const systemPrompt = buildSystemPrompt(input);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];
  const participantName = input.participantName;
  const nameHint = participantName ? ` (Participant name: ${participantName})` : "";
  for (const t of conversationHistory) {
    const role = t.role === "agent" ? "assistant" : t.role;
    messages.push({
      role: role as "user" | "assistant",
      content: t.role === "user" ? `${t.content}${nameHint}` : t.content,
    });
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: MAX_TOKENS_RESPONSE,
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: { question?: string; stopReason?: string };
  try {
    parsed = JSON.parse(cleaned) as { question?: string; stopReason?: string };
  } catch {
    return {
      agentMessage: raw || scriptedQuestions[0]?.prompt || "Tell me more.",
      suggestedAnswerTypes: ["text"],
      stopReason: "continue",
    };
  }
  const question = typeof parsed.question === "string"
    ? parsed.question.trim()
    : (raw || scriptedQuestions[0]?.prompt || "Tell me more.");
  const stopReason = (currentStep >= 1 && currentStep <= 8) ? "continue" : (parsed.stopReason === "finished" ? "finished" : "continue");
  return {
    agentMessage: question,
    suggestedAnswerTypes: ["text"],
    extractedTags: undefined,
    stopReason,
  };
}
