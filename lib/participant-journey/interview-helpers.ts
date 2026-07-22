import type { Event } from "@/data/mockEvents";
import type { AgentNextMessageResponse } from "@/data/agentInterview";
import { isEmailCaptchaPrompt } from "@/lib/agent-brief-email-captcha";
import { isNameQuestionPrompt } from "@/lib/agent-name-question";

export const THANKS_MESSAGE = "Thanks so much for sharing! That's all for now.";
export const DEFAULT_OPENING_PROMPT = "We're crowdsourcing a song for this event. Want to help create it?";
export const DEFAULT_CTA_TEXT = "Let's make an anthem";

export function displayPrompt(prompt: string): string {
  const colon = prompt.indexOf(":");
  if (colon >= 0) {
    const after = prompt.slice(colon + 1).trim();
    return after ? after.charAt(0).toUpperCase() + after.slice(1) : prompt;
  }
  return prompt;
}

export function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function eventInterviewVersion(event: Event): string {
  const payload = JSON.stringify({
    title: event.title,
    theme: event.agentThemeId ?? null,
    brief: event.agentBrief ?? null,
    journeySteps: event.journeySteps ?? event.songGardenConfig?.journeySteps ?? null,
    songGardenSteps: event.songGardenConfig?.steps ?? null,
  });
  return stableHash(payload);
}

export const sessionTokenKey = (eventId: string, version: string) =>
  `csc_agent_session_${eventId}_${version}`;
export const conversationIdKey = (eventId: string, sessionToken: string) =>
  `csc_agent_conversation_${eventId}_${sessionToken}`;
export const journeyPositionKey = (eventId: string) => `csc_journey_position_${eventId}`;

export function getOrCreateSessionToken(eventId: string, version: string): string {
  if (typeof window === "undefined") return "";
  const key = sessionTokenKey(eventId, version);
  let token = localStorage.getItem(key);
  if (!token) {
    token = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

export function suggestedTypesForMessage(
  event: Event,
  message: string | null
): AgentNextMessageResponse["suggestedAnswerTypes"] {
  if (!message) return ["text"];
  if (message === THANKS_MESSAGE) return ["text"];
  if (isNameQuestionPrompt(event.agentBrief, message)) return ["text"];
  if (isEmailCaptchaPrompt(event.agentBrief?.askAboutItems, message)) {
    return ["text", "email", "captcha"];
  }
  const items = event.agentBrief?.askAboutItems ?? [];
  const matched = items.find((item) => item?.prompt?.trim() === message.trim());
  if (matched?.allowAudio || matched?.allowVideo) {
    const types: AgentNextMessageResponse["suggestedAnswerTypes"] = ["text"];
    if (matched.allowAudio) types.push("voice");
    if (matched.allowVideo) types.push("video");
    return types;
  }
  return /record/.test(message.toLowerCase()) && /voice|video/.test(message.toLowerCase())
    ? ["text", "voice", "video"]
    : ["text"];
}

export async function withTimeout<T>(p: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        t = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
