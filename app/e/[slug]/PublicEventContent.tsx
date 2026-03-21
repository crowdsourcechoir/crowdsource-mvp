"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { Bebas_Neue } from "next/font/google";
import type { Event } from "@/data/mockEvents";
import RecordAudio from "@/components/RecordAudio";
import RecordVideo from "@/components/RecordVideo";
import TypewriterText from "@/components/TypewriterText";
import QuestionLoadingIndicator from "@/components/QuestionLoadingIndicator";
import { formatDateLong } from "@/lib/formatDate";
import { addSubmission } from "@/data/submissionsClient";
import { videoDataUrlToMp4Blob } from "@/lib/videoToMp4";
import {
  startAgentInterview,
  getConversation,
  sendMessage,
} from "@/data/agentInterview";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

type PublicEventContentProps = {
  event: Event;
};

/** Show only the question part after a colon (e.g. "Send a voice note: What does winter mean to you?" → "What does winter mean to you?") */
function displayPrompt(prompt: string): string {
  const colon = prompt.indexOf(":");
  if (colon >= 0) {
    const after = prompt.slice(colon + 1).trim();
    return after ? after.charAt(0).toUpperCase() + after.slice(1) : prompt;
  }
  return prompt;
}

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function eventInterviewVersion(event: Event): string {
  const payload = JSON.stringify({
    title: event.title,
    theme: event.agentThemeId ?? null,
    brief: event.agentBrief ?? null,
  });
  return stableHash(payload);
}

const SESSION_TOKEN_KEY = (eventId: string, version: string) => `csc_agent_session_${eventId}_${version}`;
const CONVERSATION_ID_KEY = (eventId: string, sessionToken: string) =>
  `csc_agent_conversation_${eventId}_${sessionToken}`;
const FIRST_QUESTION = "What's your name?";
const THANKS_MESSAGE = "Thanks so much for sharing! That's all for now.";
const OPENING_PROMPT = "We're crowdsourcing a song for this event. Want to help create it?";
const COMPLETION_MESSAGE = "Thanks! Your answers will help shape the song we're making.";
function getOrCreateSessionToken(eventId: string, version: string): string {
  if (typeof window === "undefined") return "";
  const key = SESSION_TOKEN_KEY(eventId, version);
  let token = localStorage.getItem(key);
  if (!token) {
    token = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

export default function PublicEventContent({ event }: PublicEventContentProps) {
  const interviewVersion = eventInterviewVersion(event);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

  /* Inline chat (agent interview) — same page, no stacking */
  const [chatStarted, setChatStarted] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [chatFinished, setChatFinished] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const firstMessageRequested = useRef(false);
  const responseInputRef = useRef<HTMLTextAreaElement | null>(null);

  function focusResponseInput() {
    if (!responseInputRef.current) return;
    // Delay one frame so focus runs after state-driven re-render.
    requestAnimationFrame(() => {
      responseInputRef.current?.focus();
    });
  }

  async function withTimeout<T>(p: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
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

  const isVoiceVideoQuestion =
    currentMessage?.toLowerCase().includes("record") &&
    (currentMessage?.toLowerCase().includes("voice") || currentMessage?.toLowerCase().includes("video"));
  /* First question is the name question; detect it for placeholder/flow handling. */
  const isNameQuestion =
    typeof currentMessage === "string"
      ? /what'?s your name\??/i.test(currentMessage)
      : !!conversationId;
  const displayMessage = currentMessage ?? (conversationId ? FIRST_QUESTION : null);

  async function handleStartChat(e: FormEvent) {
    e.preventDefault();
    if (chatStarted) return;
    setChatError(null);
    setSending(true);
    try {
      const token = getOrCreateSessionToken(event.id, interviewVersion);
      const { conversation } = await withTimeout(
        startAgentInterview(event.id, { sessionToken: token }),
        15000,
        "Timed out while starting chat. Please try again."
      );
      setConversationId(conversation.id);
      setChatStarted(true);
      setActiveSessionToken(token);
      // Persist conversation id so the chat can resume after refresh.
      if (typeof window !== "undefined") {
        localStorage.setItem(CONVERSATION_ID_KEY(event.id, token), conversation.id);
      }
      const { turns } = await withTimeout(
        getConversation(conversation.id),
        15000,
        "Timed out while loading chat history. Please refresh and try again."
      );
      if (turns.length > 0) {
        const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
        if (lastAgent) {
          setCurrentMessage(lastAgent.content);
          if (lastAgent.content === THANKS_MESSAGE) setChatFinished(true);
        }
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Couldn't start chat");
    } finally {
      setSending(false);
    }
  }

  // Rehydrate conversation after refresh so locally-stored answers feel persistent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chatStarted || conversationId) return;

    const token = getOrCreateSessionToken(event.id, interviewVersion);
    const savedConversationId = localStorage.getItem(CONVERSATION_ID_KEY(event.id, token));
    if (!savedConversationId) return;

    setConversationId(savedConversationId);
    setChatStarted(true);
    setActiveSessionToken(token);
    setChatError(null);
    setSending(true);

    getConversation(savedConversationId)
      .then(({ turns }) => {
        if (turns.length > 0) {
          const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
          if (lastAgent) {
            setCurrentMessage(lastAgent.content);
            if (lastAgent.content === THANKS_MESSAGE) setChatFinished(true);
          }
        }
      })
      .catch((err) => {
        setChatError(err instanceof Error ? err.message : "Failed to load chat");
      })
      .finally(() => setSending(false));
  }, [event.id, interviewVersion, chatStarted, conversationId]);

  useEffect(() => {
    if (!conversationId || !chatStarted) return;
    if (sending) return; // avoid racing while handleStartChat is still fetching/initializing
    if (currentMessage !== null) return; // already have a message to show
    if (firstMessageRequested.current) return;

    firstMessageRequested.current = true;

    // Trigger the first agent message as soon as the interview starts.
    // Without this, the UI can appear to "stop" after "Let's do it" if the initial DB turn hasn't been created yet.
    setSending(true);
    (async () => {
      try {
        console.debug("[PublicEventContent] auto-advancing first agent message", {
          conversationId,
        });
        const res = await withTimeout(
          sendMessage(conversationId, ""),
          20000,
          "Timed out while starting the first question."
        );
        setCurrentMessage(res.nextMessage.agentMessage);
        setChatFinished(res.nextMessage.stopReason === "finished");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start";
        console.error("[PublicEventContent] auto-advance failed", err);
        setChatError(message);

        // Fallback: reload conversation and render whatever agent turn exists.
        try {
          const { turns } = await getConversation(conversationId);
          const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
          if (lastAgent?.content) setCurrentMessage(lastAgent.content);
          if (lastAgent?.content === THANKS_MESSAGE) setChatFinished(true);
        } catch {
          // ignore fallback errors
        }
      } finally {
        setSending(false);
      }
    })();
  }, [chatStarted, conversationId, currentMessage, sending]);

  useEffect(() => {
    if (responseInputRef.current) {
      responseInputRef.current.style.height = "auto";
    }
  }, [currentMessage]);

  useEffect(() => {
    if (!chatStarted || chatFinished || sending) return;
    if (!responseInputRef.current) return;
    focusResponseInput();
  }, [chatStarted, currentMessage, chatFinished, sending]);

  function handleParticipateAgain() {
    if (typeof window === "undefined") return;
    try {
      const token =
        activeSessionToken ?? localStorage.getItem(SESSION_TOKEN_KEY(event.id, interviewVersion)) ?? null;
      if (token) {
        localStorage.removeItem(CONVERSATION_ID_KEY(event.id, token));
      }
      localStorage.removeItem(SESSION_TOKEN_KEY(event.id, interviewVersion));
    } catch {
      // ignore
    }

    firstMessageRequested.current = false;
    setChatStarted(false);
    setConversationId(null);
    setActiveSessionToken(null);
    setCurrentMessage(null);
    setChatFinished(false);
    setChatError(null);
    setInputValue("");
    setSending(false);
    setAudioBlob(null);
    setVideoBlob(null);
  }

  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    if (!conversationId || sending || chatFinished) return;
    if (!inputValue.trim() && !audioBlob && !videoBlob && !isVoiceVideoQuestion) return;
    const content = inputValue.trim();
    setInputValue("");
    if (responseInputRef.current) {
      responseInputRef.current.style.height = "auto";
    }
    setChatError(null);
    setSending(true);
    try {
      const audioDataUrl = audioBlob ? await blobToDataUrl(audioBlob) : null;
      const videoDataUrl = videoBlob ? await blobToDataUrl(videoBlob) : null;
      const res = await sendMessage(conversationId, content, { audioDataUrl, videoDataUrl });
      setAudioBlob(null);
      setVideoBlob(null);
      setCurrentMessage(res.nextMessage.agentMessage);
      setChatFinished(res.nextMessage.stopReason === "finished");
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSending(false);
      if (!chatFinished) {
        focusResponseInput();
      }
    }
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const form = e.currentTarget;
      const name = (form.querySelector('[name="name"]') as HTMLInputElement)?.value?.trim() || null;
      let audioDataUrl: string | null = null;
      let videoDataUrl: string | null = null;
      if (audioBlob) audioDataUrl = await blobToDataUrl(audioBlob);
      if (videoBlob) {
        const rawVideoUrl = await blobToDataUrl(videoBlob);
        if (rawVideoUrl.startsWith("data:video/webm")) {
          try {
            const mp4Blob = await videoDataUrlToMp4Blob(rawVideoUrl);
            videoDataUrl = await blobToDataUrl(mp4Blob);
          } catch {
            videoDataUrl = rawVideoUrl;
          }
        } else {
          videoDataUrl = rawVideoUrl;
        }
      }
      await addSubmission(event.slug, { name, audioDataUrl, videoDataUrl });
      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      const isQuota = err instanceof DOMException && err.name === "QuotaExceededError";
      setSubmitError(
        isQuota
          ? "Storage full. Clear site data for this site in your browser settings, then try again."
          : "Submit failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden text-gray-100 pb-[env(safe-area-inset-bottom)]"
      style={{ ["--crowdsource-accent" as string]: "#CFFF81" }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/public-bg.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/20" aria-hidden />

      <div
        className={`relative mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 text-center sm:px-5 ${
          chatStarted ? "py-6 sm:py-7" : "py-6 sm:py-10"
        }`}
      >
        <a
          href="https://crowdsourcechoir.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`block w-fit opacity-95 mx-auto ${chatStarted ? "mb-6 sm:mb-7" : "mb-10"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Crowdsource Choir" className={`${chatStarted ? "h-12 sm:h-16" : "h-16 sm:h-20"} w-auto`} />
        </a>

        {!chatStarted && event.heroImage && (
          <div className="mx-auto mb-6 w-full max-w-64 sm:mb-8 sm:max-w-72">
            <div className="relative aspect-square overflow-hidden rounded-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.heroImage} alt="" className="h-full w-full object-cover grayscale" />
              <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-700/35 via-pink-500/15 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            </div>
          </div>
        )}

        <div className={chatStarted ? "flex min-h-[calc(100dvh-150px)] flex-col" : "space-y-6"}>
          <div className={`mx-auto w-full max-w-2xl ${chatStarted ? "mt-[10vh] mb-6 sm:mt-[8vh] sm:mb-8" : ""}`}>
            <h1 className={`${bebasNeue.className} leading-none tracking-wide text-[var(--crowdsource-accent)] ${chatStarted ? "mt-3 text-4xl sm:text-5xl" : "mt-2 text-5xl sm:text-6xl"}`}>
              {event.title}
            </h1>
            {!chatStarted && (
              <p className="mt-2 font-mono text-base text-gray-100">
                <span className="text-[var(--crowdsource-accent)]">{formatDateLong(event.date)} · </span>
                <span>{event.venue}</span>
                {event.address ? <span className="text-gray-300"> ({event.address})</span> : null}
              </p>
            )}
          </div>

          <div className={chatStarted ? "flex flex-1 items-start justify-center pt-6 sm:pt-8" : "pt-2"}>
            {/* Chatbot opens with a prompt; "Let's do it." starts the interview */}
            <div className="w-full">
                {!chatStarted ? (
                  <>
                    {/* Same prompt treatment as chat questions: typewriter + same font size */}
                    <div className="min-h-[76px] py-2 sm:min-h-[100px] sm:py-4">
                      <p className="mx-auto max-w-xl font-mono text-base leading-snug text-gray-200 sm:text-lg">
                        <TypewriterText
                          key="opening"
                          text={OPENING_PROMPT}
                          speed={9}
                          className="inline"
                        />
                      </p>
                    </div>
                    <div className="mt-6">
                      <form onSubmit={handleStartChat} className="mx-auto w-full max-w-lg">
                        <button
                          type="submit"
                          disabled={sending}
                          className="flex min-h-[56px] w-full items-center justify-center border border-[var(--crowdsource-accent)] bg-transparent px-6 py-3 font-mono text-base font-medium tracking-wide text-[var(--crowdsource-accent)] shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm transition hover:bg-[#CFFF81] hover:text-[#1a1530] focus:outline-none focus:ring-2 focus:ring-[var(--crowdsource-accent)]/70 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50"
                        >
                          {sending ? "Starting…" : "Let's make a song"}
                        </button>
                      </form>
                      {!chatFinished && chatError && (
                        <p className="mt-4 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                          {chatError}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  /* Chat: floating question text, single response bubble for input */
                  <div className="mx-auto flex w-full max-w-lg flex-col">
                    {chatError && !chatError.includes("You can only skip the name question") && (
                      <p className="mb-4 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                        {chatError}
                      </p>
                    )}
                    {/* Floating question — no bubble */}
                    <div
                      className={
                        chatFinished
                          ? "mx-auto w-full max-w-lg py-2 sm:py-3"
                          : "mx-auto w-full max-w-lg min-h-[76px] py-2 sm:min-h-[100px] sm:py-4"
                      }
                    >
                      <p className="mx-auto max-w-xl font-mono text-base leading-snug text-gray-200 sm:text-lg">
                        {chatFinished ? (
                          <TypewriterText
                            key={`completion-${conversationId ?? "none"}`}
                            text={COMPLETION_MESSAGE}
                            speed={9}
                            className="inline"
                          />
                        ) : sending && !chatFinished ? (
                          <QuestionLoadingIndicator
                            size="lg"
                            label="Getting your next question…"
                          />
                        ) : displayMessage ? (
                          <TypewriterText
                            key={displayMessage}
                            text={displayMessage}
                            speed={9}
                            className="inline"
                          />
                        ) : (
                          <QuestionLoadingIndicator size="lg" label="Loading…" />
                        )}
                      </p>
                    </div>
                    {chatFinished && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={handleParticipateAgain}
                          disabled={sending}
                          className="flex min-h-[72px] w-full items-center justify-center border border-[var(--crowdsource-accent)] bg-transparent px-6 py-3 font-mono text-base font-medium tracking-wide text-[var(--crowdsource-accent)] transition hover:bg-[var(--crowdsource-accent)] hover:text-[#1a1530] focus:outline-none focus:ring-2 focus:ring-[var(--crowdsource-accent)] focus:ring-offset-2 focus:ring-offset-[#18181b] disabled:opacity-50"
                        >
                          {"Let's do it again"}
                        </button>
                      </div>
                    )}
                    {!chatFinished && (
                      <form
                        onSubmit={handleChatSubmit}
                        aria-busy={sending}
                        className={`mx-auto w-full max-w-lg ${chatStarted ? "mt-4" : "mt-6"}`}
                      >
                        <div className="flex w-full gap-2 rounded-none bg-black/20 px-3 py-2.5 backdrop-blur-sm">
                          <textarea
                            ref={responseInputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                const form = e.currentTarget.form;
                                if (form) form.requestSubmit();
                              }
                            }}
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = "auto";
                              el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
                            }}
                            placeholder={isNameQuestion ? "Your name" : "Type your answer…"}
                            disabled={sending}
                            rows={1}
                            className="min-h-[52px] max-h-[180px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-3 font-mono text-base font-medium tracking-wide leading-6 text-white placeholder-gray-300 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={sending || (!inputValue.trim() && !audioBlob && !videoBlob && !isVoiceVideoQuestion)}
                            className="inline-flex min-h-[44px] min-w-[5.5rem] shrink-0 items-center justify-center gap-2 px-2 py-2 text-center font-mono text-base font-medium tracking-wide text-[var(--crowdsource-accent)] transition hover:opacity-85 disabled:text-[var(--crowdsource-accent)]"
                          >
                            {sending ? (
                              <>
                                <svg
                                  className="h-4 w-4 shrink-0 animate-spin text-[var(--crowdsource-accent)]"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  aria-hidden
                                >
                                  <circle
                                    className="opacity-35"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-95"
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
                          <div className="mt-4 w-full space-y-3 rounded-none bg-black/25 p-3 sm:p-4 backdrop-blur-sm">
                            <p className="font-mono text-base font-medium tracking-wide text-gray-300">
                              Record a message (optional)
                            </p>
                            <RecordAudio onRecordingReady={setAudioBlob} onClear={() => setAudioBlob(null)} />
                            <RecordVideo onRecordingReady={setVideoBlob} onClear={() => setVideoBlob(null)} />
                          </div>
                        )}
                      </form>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
