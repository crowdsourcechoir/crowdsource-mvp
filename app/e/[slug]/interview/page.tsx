"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import TypewriterText from "@/components/TypewriterText";
import QuestionLoadingIndicator from "@/components/QuestionLoadingIndicator";
import EventPageLoadingShell from "@/components/EventPageLoadingShell";
import {
  startAgentInterview,
  getConversation,
  sendMessage,
  type AgentConversationTurn,
} from "@/data/agentInterview";
import RecordAudio from "@/components/RecordAudio";
import RecordVideo from "@/components/RecordVideo";

const SESSION_TOKEN_KEY = (eventId: string) => `csc_agent_session_${eventId}`;

function getOrCreateSessionToken(eventId: string, fresh: boolean): string {
  if (typeof window === "undefined") return "";
  const key = SESSION_TOKEN_KEY(eventId);
  if (fresh) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  let token = localStorage.getItem(key);
  if (!token) {
    token = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

export default function InterviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const nameFromUrl = searchParams.get("name")?.trim() || undefined;
  const emailFromUrl = searchParams.get("email")?.trim() || undefined;
  const fresh = searchParams.get("fresh") === "1";
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<AgentConversationTurn[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstMessageRequested = useRef(false);

  const isVoiceVideoQuestion =
    currentMessage?.toLowerCase().includes("record") &&
    (currentMessage?.toLowerCase().includes("voice") || currentMessage?.toLowerCase().includes("video"));
  /* Allow skip when this is the name question (by content) or when we're on the first step (loading or only name question in turns) */
  const isNameQuestion =
    (typeof currentMessage === "string" && /name/i.test(currentMessage) && /anonymous|skip/i.test(currentMessage)) ||
    (turns.length === 1 && turns[0].role === "agent" && /name/i.test(String(turns[0].content)) && /anonymous|skip/i.test(String(turns[0].content))) ||
    (turns.length === 0 && !!conversationId);

  const fetchConversation = useCallback(async (convId: string) => {
    const { turns: nextTurns } = await getConversation(convId);
    setTurns(nextTurns);
    const lastAgent = [...nextTurns].reverse().find((t) => t.role === "agent");
    setCurrentMessage(lastAgent?.content ?? null);
    return nextTurns;
  }, []);

  useEffect(() => {
    getEventBySlug(slug)
      .then((e) => {
        setEvent(e ?? null);
        return e;
      })
      .catch(() => setEvent(null))
      .finally(() => setLoaded(true));
  }, [slug]);

  useEffect(() => {
    const refetch = () => {
      getEventBySlug(slug).then((e) => e && setEvent(e)).catch(() => {});
    };
    if (document.visibilityState === "visible" && slug) refetch();
    const handler = () => {
      if (document.visibilityState === "visible" && slug) refetch();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [slug]);

  useEffect(() => {
    if (!event?.id || !event.agentThemeId) return;
    firstMessageRequested.current = false;
    setTurns([]);
    setCurrentMessage(null);
    setFinished(false);
    setConversationId(null);
    setError(null);

    const token = getOrCreateSessionToken(event.id, fresh);
    if (!nameFromUrl || !emailFromUrl) {
      setError("Display name and email are required. Start from the event page.");
      return;
    }
    startAgentInterview(event.id, {
      sessionToken: token,
      displayName: nameFromUrl,
      email: emailFromUrl,
    })
      .then(({ conversation }) => {
        setConversationId(conversation.id);
        return fetchConversation(conversation.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to start interview"));
  }, [event?.id, event?.agentThemeId, nameFromUrl, emailFromUrl, fetchConversation, fresh]);

  useEffect(() => {
    if (!conversationId || turns.length > 0 || firstMessageRequested.current) return;
    firstMessageRequested.current = true;
    setSending(true);
    sendMessage(conversationId, "")
      .then((res) => {
        setCurrentMessage(res.nextMessage.agentMessage);
        setFinished(res.nextMessage.stopReason === "finished");
        if (res.agentTurn) setTurns([res.agentTurn]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to start"))
      .finally(() => setSending(false));
  }, [conversationId, turns.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conversationId || sending || finished) return;
    if (!inputValue.trim() && !isVoiceVideoQuestion && !isNameQuestion) return;
    const content = inputValue.trim();
    setInputValue("");
    setSending(true);
    setError(null);
    try {
      const res = await sendMessage(conversationId, content);
      setTurns((prev) => [
        ...prev,
        ...(res.turn ? [res.turn] : []),
        ...(res.agentTurn ? [res.agentTurn] : []),
      ]);
      setCurrentMessage(res.nextMessage.agentMessage);
      setFinished(res.nextMessage.stopReason === "finished");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSending(false);
    }
  }

  if (!loaded) {
    return <EventPageLoadingShell compact />;
  }
  if (!event) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] p-8 text-center text-gray-400">
        <p>Event not found.</p>
        <Link href="/" className="mt-4 inline-block font-medium hover:underline" style={{ color: "var(--crowdsource-accent)" }}>Back</Link>
      </div>
    );
  }
  if (!event.agentThemeId) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] p-8 text-center text-gray-400">
        <p>Agent Interview is not enabled for this event.</p>
        <Link href={`/e/${slug}`} className="mt-4 inline-block font-medium hover:underline" style={{ color: "var(--crowdsource-accent)" }}>Back to event</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/e/${slug}`} className="text-sm font-medium hover:underline" style={{ color: "var(--crowdsource-accent)" }}>
            ← Back to event
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
          <h1 className="text-lg font-semibold text-white">{event.title}</h1>
          <p className="mt-1 text-sm text-gray-500">Short Q&A — answer casually, one question at a time.</p>

          {error && !error.includes("You can only skip the name question") && (
            <p className="mt-4 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="mt-6 space-y-4">
            {turns.map((t) =>
              t.role === "agent" ? (
                <p key={t.id} className="text-left text-lg leading-snug text-gray-200">
                  {t.content}
                </p>
              ) : (
                <div key={t.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl border border-gray-600/60 bg-[#252528] px-4 py-3 text-gray-100">
                    <p className="text-[15px]">{t.content}</p>
                  </div>
                </div>
              )
            )}
            {currentMessage && !turns.some((t) => t.content === currentMessage) && (
              <p className="text-left text-lg leading-snug text-gray-200">
                <TypewriterText text={currentMessage} speed={9} className="inline" />
              </p>
            )}
            {sending && !finished && (
              <div className="rounded-xl border border-gray-700/50 bg-[#252528]/60 px-4 py-3">
                <QuestionLoadingIndicator />
              </div>
            )}
          </div>

          {finished ? (
            <div className="mt-8 rounded-xl border border-green-800/60 bg-green-900/20 px-4 py-4 text-center">
              <p className="font-medium text-green-300">Thanks! You&apos;re done.</p>
              <p className="mt-1 text-sm text-gray-400">You can add voice or video later if the host enables it.</p>
              <Link href={`/e/${slug}`} className="mt-4 inline-block text-sm font-medium hover:underline" style={{ color: "var(--crowdsource-accent)" }}>
                Back to event
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6">
              <label htmlFor="reply" className="block text-sm font-medium text-gray-400 mb-2">
                {isVoiceVideoQuestion ? "Your response (text optional)" : "Your answer"}
              </label>
              <div className="flex gap-2 rounded-2xl border border-gray-600/60 bg-[#252528] px-3 py-2.5 shadow-sm">
                <input
                  id="reply"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={isVoiceVideoQuestion ? "Add text (optional) or record below, then Submit" : isNameQuestion ? "Your name or leave blank…" : "Type your answer…"}
                  disabled={sending}
                  className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-white placeholder-gray-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || (!inputValue.trim() && !isVoiceVideoQuestion && !isNameQuestion)}
                  className="inline-flex min-w-[5.5rem] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--crowdsource-accent)" }}
                >
                  {sending ? (
                    <>
                      <svg
                        className="h-4 w-4 shrink-0 animate-spin text-[#1a1530]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <circle
                          className="opacity-30"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-90"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Sending</span>
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
              {isVoiceVideoQuestion && (
                <div className="mt-6 space-y-4 rounded-xl border border-gray-700/60 bg-[#1f1f1f] p-4">
                  <p className="text-sm font-medium text-gray-300">Or record a voice or video message (optional)</p>
                  <RecordAudio onRecordingReady={() => {}} onClear={() => {}} />
                  <RecordVideo onRecordingReady={() => {}} onClear={() => {}} />
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
