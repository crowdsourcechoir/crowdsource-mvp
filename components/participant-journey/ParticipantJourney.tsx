"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Event } from "@/data/mockEvents";
import RecordAudio from "@/components/RecordAudio";
import RecordVideo from "@/components/RecordVideo";
import TypewriterText from "@/components/TypewriterText";
import QuestionLoadingIndicator from "@/components/QuestionLoadingIndicator";
import TurnstileWidget from "@/components/TurnstileWidget";
import SoundGardenExperience from "@/components/songgarden/SoundGardenExperience";
import CompositionStrip from "@/components/participant-journey/CompositionStrip";
import {
  startAgentInterview,
  getConversation,
  sendMessage,
  type AgentNextMessageResponse,
} from "@/data/agentInterview";
import { grantSonggardenAccess, getSonggardenContributorName, setSonggardenContributorName } from "@/data/songgardenClient";
import { loadDoneSlots, clearDoneSlots } from "@/lib/songgarden/garden-storage";
import type { GardenSlotId } from "@/lib/songgarden/garden-slots";
import {
  blobToDataUrl,
  conversationIdKey,
  DEFAULT_CTA_TEXT,
  DEFAULT_OPENING_PROMPT,
  displayPrompt,
  eventInterviewVersion,
  getOrCreateSessionToken,
  journeyPositionKey,
  sessionTokenKey,
  suggestedTypesForMessage,
  THANKS_MESSAGE,
  withTimeout,
} from "@/lib/participant-journey/interview-helpers";
import {
  allGardenSlotsDone,
  DEFAULT_JOURNEY_FINAL_MESSAGE,
  firstIncompleteGardenIndex,
  getEnabledGardenSteps,
  journeyProgress,
  soundTransitionMessage,
  type JourneyPosition,
} from "@/lib/participant-journey/steps";
import { compositionStripSlotOrder } from "@/lib/songgarden/config";
import { isNameQuestionPrompt } from "@/lib/agent-name-question";
import {
  contributionConsentText,
  requiresContributionConsent,
} from "@/lib/participant-journey/contribution-consent";
import ContributionConsentCheckbox from "@/components/participant-journey/ContributionConsentCheckbox";
import { isTurnstileClientConfigured, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

type ParticipantJourneyProps = {
  event: Event;
  /** Admin deep-link: skip to first incomplete sound step */
  startAtGarden?: boolean;
  onActiveChange?: (active: boolean) => void;
};

function loadJourneyPosition(eventId: string, interviewVersion: string): JourneyPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(journeyPositionKey(eventId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as JourneyPosition;
    if (saved.interviewVersion !== interviewVersion) return null;
    return saved;
  } catch {
    return null;
  }
}

function saveJourneyPosition(eventId: string, position: JourneyPosition): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(journeyPositionKey(eventId), JSON.stringify(position));
}

function findSavedConversationId(eventId: string, sessionToken: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(conversationIdKey(eventId, sessionToken));
}

function clearJourneySession(event: Event, interviewVersion: string, sessionToken: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionToken) {
      localStorage.removeItem(conversationIdKey(event.id, sessionToken));
    }
    localStorage.removeItem(sessionTokenKey(event.id, interviewVersion));
    localStorage.removeItem(journeyPositionKey(event.id));
  } catch {
    // ignore
  }
}

export default function ParticipantJourney({
  event,
  startAtGarden = false,
  onActiveChange,
}: ParticipantJourneyProps) {
  const interviewVersion = eventInterviewVersion(event);
  const gardenSteps = useMemo(() => getEnabledGardenSteps(event), [event]);
  const stripSlotOrder = useMemo(() => compositionStripSlotOrder(event), [event]);

  const [position, setPosition] = useState<JourneyPosition>(() => {
    if (startAtGarden) {
      const done = loadDoneSlots(event.id);
      if (allGardenSlotsDone(event, done)) {
        return { phase: "final", gardenSlotIndex: Math.max(0, gardenSteps.length - 1) };
      }
      return { phase: "garden", gardenSlotIndex: firstIncompleteGardenIndex(event, done) };
    }
    const saved = loadJourneyPosition(event.id, interviewVersion);
    if (saved) return saved;
    return { phase: "landing", gardenSlotIndex: 0, interviewVersion };
  });
  const [lyricQuestionIndex, setLyricQuestionIndex] = useState(0);
  const [doneSlots, setDoneSlots] = useState<Set<GardenSlotId>>(() => loadDoneSlots(event.id));
  const [transitionReady, setTransitionReady] = useState(false);

  const [journeyStarted, setJourneyStarted] = useState(position.phase !== "landing");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [chatFinished, setChatFinished] = useState(false);
  const [currentSuggestedAnswerTypes, setCurrentSuggestedAnswerTypes] = useState<
    AgentNextMessageResponse["suggestedAnswerTypes"]
  >(["text"]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [emailCaptchaToken, setEmailCaptchaToken] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [contributorName, setContributorName] = useState(
    () => getSonggardenContributorName(event.id) ?? ""
  );
  const [contributionConsentAgreed, setContributionConsentAgreed] = useState(false);
  const requireContributionConsent = requiresContributionConsent(event);
  const contributionConsentLabel = contributionConsentText(event);
  const [nameGate, setNameGate] = useState(
    () => startAtGarden && !getSonggardenContributorName(event.id)?.trim()
  );

  const firstMessageRequested = useRef(false);
  const responseInputRef = useRef<HTMLTextAreaElement | null>(null);
  const slotCompleteTimer = useRef<number | null>(null);

  const setPositionPersisted = useCallback(
    (next: Omit<JourneyPosition, "interviewVersion"> & Partial<Pick<JourneyPosition, "interviewVersion">>) => {
      const withVersion: JourneyPosition = { ...next, interviewVersion };
      setPosition(withVersion);
      saveJourneyPosition(event.id, withVersion);
    },
    [event.id, interviewVersion]
  );

  useEffect(() => {
    grantSonggardenAccess(event.id);
  }, [event.id]);

  useEffect(() => {
    onActiveChange?.(journeyStarted);
  }, [journeyStarted, onActiveChange]);

  useEffect(() => {
    return () => {
      if (slotCompleteTimer.current) clearTimeout(slotCompleteTimer.current);
    };
  }, []);

  const progress = journeyProgress(event, position, lyricQuestionIndex);
  const showProgress = journeyStarted && position.phase !== "final";
  const showComposition =
    position.phase === "sound_transition" ||
    position.phase === "garden" ||
    position.phase === "final";

  const activeGardenStep =
    position.phase === "garden" ? gardenSteps[position.gardenSlotIndex] : null;

  const allowAudioResponse = currentSuggestedAnswerTypes.includes("voice");
  const allowVideoResponse = currentSuggestedAnswerTypes.includes("video");
  const requiresEmailResponse = currentSuggestedAnswerTypes.includes("email");
  const requiresCaptchaResponse = currentSuggestedAnswerTypes.includes("captcha");
  const captchaGateActive = requiresCaptchaResponse && isTurnstileClientConfigured();
  const captchaSetupRequired = requiresCaptchaResponse && !isTurnstileClientConfigured();
  const allowsMediaResponse = allowAudioResponse || allowVideoResponse;

  function focusResponseInput() {
    requestAnimationFrame(() => responseInputRef.current?.focus());
  }

  const beginLyricPhase = useCallback(async () => {
    setChatError(null);
    firstMessageRequested.current = false;
    setLyricQuestionIndex(0);
    setSending(true);
    try {
      const token = getOrCreateSessionToken(event.id, interviewVersion);
      const { conversation } = await withTimeout(
        startAgentInterview(event.id, {
          sessionToken: token,
        }),
        15000,
        "Timed out while starting. Please try again."
      );
      setConversationId(conversation.id);
      setActiveSessionToken(token);
      setJourneyStarted(true);
      setPositionPersisted({ phase: "lyric", gardenSlotIndex: 0 });
      localStorage.setItem(conversationIdKey(event.id, token), conversation.id);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Couldn't start");
    } finally {
      setSending(false);
    }
  }, [event.id, interviewVersion, setPositionPersisted]);

  async function handleStartJourney(e: FormEvent) {
    e.preventDefault();
    if (journeyStarted) return;
    if (requireContributionConsent && !contributionConsentAgreed) {
      setChatError("Please confirm how your contributions may be used.");
      return;
    }
    await beginLyricPhase();
  }

  // Rehydrate conversation after refresh
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (startAtGarden) return;
    if (conversationId || position.phase === "landing" || position.phase === "final") return;
    if (position.phase === "garden" || position.phase === "sound_transition") return;

    const token = getOrCreateSessionToken(event.id, interviewVersion);
    const savedConversationId = findSavedConversationId(event.id, token);
    if (!savedConversationId) {
      if (position.phase === "lyric" || position.phase === "sound_transition") {
        setPositionPersisted({ phase: "landing", gardenSlotIndex: 0 });
        setJourneyStarted(false);
        firstMessageRequested.current = false;
      }
      return;
    }

    setConversationId(savedConversationId);
    setActiveSessionToken(token);
    setJourneyStarted(true);
    setChatError(null);
    setSending(true);

    getConversation(savedConversationId)
      .then(({ turns }) => {
        const agentTurns = turns.filter((t) => t.role === "agent").length;
        setLyricQuestionIndex(agentTurns);

        const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
        if (lastAgent) {
          setCurrentMessage(lastAgent.content);
          setCurrentSuggestedAnswerTypes(suggestedTypesForMessage(event, lastAgent.content));
            if (lastAgent.content === THANKS_MESSAGE) {
              setChatFinished(true);
              const done = loadDoneSlots(event.id);
              if (allGardenSlotsDone(event, done)) {
                setPositionPersisted({
                  phase: "final",
                  gardenSlotIndex: Math.max(0, gardenSteps.length - 1),
                });
              } else if (position.phase === "lyric") {
              setPositionPersisted({ phase: "sound_transition", gardenSlotIndex: 0 });
            }
          } else {
            setPositionPersisted({ phase: "lyric", gardenSlotIndex: 0 });
          }
        }
      })
      .catch((err) => {
        setChatError(err instanceof Error ? err.message : "Failed to load progress");
      })
      .finally(() => setSending(false));
  }, [conversationId, event, gardenSteps.length, interviewVersion, position.phase, setPositionPersisted, startAtGarden]);

  // First agent message
  useEffect(() => {
    if (position.phase !== "lyric") return;
    if (!conversationId) return;
    if (currentMessage !== null) return;
    if (firstMessageRequested.current) return;

    firstMessageRequested.current = true;
    let cancelled = false;
    setSending(true);
    (async () => {
      try {
        const res = await withTimeout(
          sendMessage(conversationId, ""),
          20000,
          "Timed out while starting the first question."
        );
        if (cancelled) return;
        setCurrentMessage(res.nextMessage.agentMessage);
        setCurrentSuggestedAnswerTypes(res.nextMessage.suggestedAnswerTypes ?? ["text"]);
        setLyricQuestionIndex(1);
        if (res.nextMessage.stopReason === "finished") {
          setChatFinished(true);
          setPositionPersisted({ phase: "sound_transition", gardenSlotIndex: 0 });
        }
      } catch (err) {
        if (cancelled) return;
        setChatError(err instanceof Error ? err.message : "Failed to start");
        let recovered = false;
        try {
          const { turns } = await getConversation(conversationId);
          const agentTurns = turns.filter((t) => t.role === "agent").length;
          setLyricQuestionIndex(agentTurns || 1);
          const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
          if (lastAgent?.content) {
            setCurrentMessage(lastAgent.content);
            setCurrentSuggestedAnswerTypes(suggestedTypesForMessage(event, lastAgent.content));
            recovered = true;
          }
          if (lastAgent?.content === THANKS_MESSAGE) {
            setChatFinished(true);
            setPositionPersisted({ phase: "sound_transition", gardenSlotIndex: 0 });
          }
        } catch {
          // ignore
        }
        if (!recovered) {
          firstMessageRequested.current = false;
        }
      } finally {
        if (!cancelled) setSending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, currentMessage, event, position.phase, setPositionPersisted]);

  useEffect(() => {
    setEmailCaptchaToken(null);
  }, [currentMessage]);

  useEffect(() => {
    if (position.phase !== "lyric" || chatFinished || sending) return;
    focusResponseInput();
  }, [position.phase, currentMessage, chatFinished, sending]);

  useEffect(() => {
    if (position.phase !== "sound_transition") {
      setTransitionReady(false);
      return;
    }
    const t = window.setTimeout(() => setTransitionReady(true), 1200);
    return () => window.clearTimeout(t);
  }, [position.phase]);

  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    if (!conversationId || sending || chatFinished || position.phase !== "lyric") return;
    if (requiresEmailResponse && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputValue.trim())) {
      setChatError("Please enter a valid email address.");
      return;
    }
    if (captchaSetupRequired) {
      setChatError("Email verification is not configured. Check /api/turnstile/status.");
      return;
    }
    if (captchaGateActive && !emailCaptchaToken) {
      setChatError("Complete the quick verification check, then submit.");
      return;
    }
    if (isNameQuestionPrompt(event.agentBrief, currentMessage) && !inputValue.trim()) {
      setChatError("Please enter a name.");
      return;
    }
    if (!inputValue.trim() && !audioBlob && !videoBlob && !allowsMediaResponse) return;

    const content = inputValue.trim();
    const answeredNameQuestion = isNameQuestionPrompt(event.agentBrief, currentMessage);
    setInputValue("");
    if (responseInputRef.current) responseInputRef.current.style.height = "auto";
    setChatError(null);
    setSending(true);

    try {
      const audioDataUrl = audioBlob ? await blobToDataUrl(audioBlob) : null;
      const videoDataUrl = videoBlob ? await blobToDataUrl(videoBlob) : null;
      const res = await sendMessage(conversationId, content, {
        audioDataUrl,
        videoDataUrl,
        captchaToken: captchaGateActive ? emailCaptchaToken : null,
      });
      setAudioBlob(null);
      setVideoBlob(null);
      setEmailCaptchaToken(null);

      if (answeredNameQuestion && content) {
        setSonggardenContributorName(event.id, content);
        setContributorName(content);
      }

      if (res.nextMessage.stopReason === "finished") {
        setChatFinished(true);
        setCurrentMessage(null);
        setPositionPersisted({ phase: "sound_transition", gardenSlotIndex: 0 });
      } else {
        setLyricQuestionIndex((n) => n + 1);
        setCurrentMessage(res.nextMessage.agentMessage);
        setCurrentSuggestedAnswerTypes(res.nextMessage.suggestedAnswerTypes ?? ["text"]);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSending(false);
      if (!chatFinished) focusResponseInput();
    }
  }

  function saveContributorName(): boolean {
    const trimmedName = contributorName.trim();
    if (!trimmedName) {
      setChatError("Please add your name so we can credit your sounds.");
      return false;
    }
    setSonggardenContributorName(event.id, trimmedName);
    setChatError(null);
    return true;
  }

  function handleNameGateContinue() {
    if (!saveContributorName()) return;
    setNameGate(false);
  }

  function handleSoundTransitionContinue() {
    const done = loadDoneSlots(event.id);
    setDoneSlots(done);
    setPositionPersisted({
      phase: "garden",
      gardenSlotIndex: firstIncompleteGardenIndex(event, done),
    });
  }

  const handleSlotComplete = useCallback(
    (slotId: GardenSlotId) => {
      const updated = loadDoneSlots(event.id);
      setDoneSlots(updated);

      const currentIndex = gardenSteps.findIndex((step) => step.slot.id === slotId);
      const nextIndex = currentIndex + 1;

      if (slotCompleteTimer.current) clearTimeout(slotCompleteTimer.current);
      slotCompleteTimer.current = window.setTimeout(() => {
        if (nextIndex >= gardenSteps.length) {
          setPositionPersisted({
            phase: "final",
            gardenSlotIndex: Math.max(0, gardenSteps.length - 1),
          });
        } else {
          setPositionPersisted({ phase: "garden", gardenSlotIndex: nextIndex });
        }
      }, 700);
    },
    [event.id, gardenSteps, setPositionPersisted]
  );

  function handleParticipateAgain() {
    clearJourneySession(event, interviewVersion, activeSessionToken);
    clearDoneSlots(event.id);
    firstMessageRequested.current = false;
    setJourneyStarted(false);
    setPosition({ phase: "landing", gardenSlotIndex: 0, interviewVersion });
    setLyricQuestionIndex(0);
    setContributionConsentAgreed(false);
    setConversationId(null);
    setActiveSessionToken(null);
    setCurrentMessage(null);
    setCurrentSuggestedAnswerTypes(["text"]);
    setChatFinished(false);
    setChatError(null);
    setInputValue("");
    setSending(false);
    setAudioBlob(null);
    setVideoBlob(null);
    setDoneSlots(new Set());
  }

  const finalMessage =
    event.anthemCompletionMessage?.trim() || DEFAULT_JOURNEY_FINAL_MESSAGE;

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg text-left">
      {showProgress && (
        <div className="mb-3 sm:mb-5">
          <div className="h-1 overflow-hidden bg-white/10">
            <div
              className="h-full bg-[var(--crowdsource-accent)] transition-all duration-500 ease-out"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-[10px] tracking-wide text-gray-400">
            {progress.completed} of {progress.total}
          </p>
        </div>
      )}

      {showComposition && (
        <div className="mb-3 sm:mb-5">
          <CompositionStrip
            doneSlots={doneSlots}
            activeSlotId={activeGardenStep?.slot.id ?? null}
            beatSlotIds={stripSlotOrder.beat}
            choirSlotIds={stripSlotOrder.choir}
          />
        </div>
      )}

      {position.phase === "landing" && (
        <>
          <div className="min-h-[4.5rem] py-2 text-center sm:min-h-[100px] sm:py-4">
            <p className="mx-auto max-w-xl font-mono text-[1.0625rem] leading-snug text-gray-200 sm:text-lg">
              <TypewriterText
                key="opening"
                text={event.landingHeadline || DEFAULT_OPENING_PROMPT}
                speed={9}
                className="inline"
              />
            </p>
          </div>
          {!!event.landingCopy && (
            <p className="mx-auto mt-1 max-w-xl text-center font-mono text-sm text-gray-300 sm:text-base">
              {event.landingCopy}
            </p>
          )}
          <form onSubmit={handleStartJourney} className="mt-5 space-y-4 sm:mt-6">
            {requireContributionConsent && (
              <ContributionConsentCheckbox
                checked={contributionConsentAgreed}
                onChange={setContributionConsentAgreed}
                text={contributionConsentLabel}
                className="px-1"
              />
            )}
            <button
              type="submit"
              disabled={
                sending || (requireContributionConsent && !contributionConsentAgreed)
              }
              className="crowdsource-btn-primary"
            >
              {sending ? "Starting…" : event.ctaText || DEFAULT_CTA_TEXT}
            </button>
          </form>
          {chatError && (
            <p className="mt-4 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {chatError}
            </p>
          )}
        </>
      )}

      {position.phase === "lyric" && (
        <div className="flex flex-col">
          {chatError && (
            <p className="mb-4 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {chatError}
            </p>
          )}
          <div className="mx-auto w-full min-h-[4.5rem] py-2 sm:min-h-[100px] sm:py-4">
            <p className="mx-auto max-w-xl text-center font-mono text-[1.0625rem] leading-snug text-gray-200 sm:text-left sm:text-lg">
              {sending && !currentMessage ? (
                <QuestionLoadingIndicator size="lg" />
              ) : currentMessage ? (
                <TypewriterText
                  key={currentMessage}
                  text={displayPrompt(currentMessage)}
                  speed={9}
                  className="inline"
                />
              ) : (
                <QuestionLoadingIndicator size="lg" />
              )}
            </p>
          </div>
          <form
            onSubmit={handleChatSubmit}
            aria-busy={sending}
            className="sticky bottom-0 z-10 mt-4 bg-[#1a0f2d] pt-3 sm:static sm:bg-transparent sm:pt-0"
          >
            {captchaSetupRequired && (
              <div className="mb-4 rounded-none border border-amber-500/40 bg-amber-950/30 px-4 py-3">
                <p className="font-mono text-xs leading-relaxed text-amber-100">
                  Email captcha requires Turnstile keys in .env.local.
                </p>
              </div>
            )}
            <div className="crowdsource-field-panel w-full space-y-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
              {captchaGateActive && (
                <div className="flex flex-col items-center gap-2 pb-1">
                  <p className="font-mono text-base font-medium tracking-wide text-gray-300">
                    Quick verification — then submit your email.
                  </p>
                  <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setEmailCaptchaToken} />
                </div>
              )}
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-2">
                <textarea
                  ref={responseInputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
                  }}
                  placeholder={requiresEmailResponse ? "you@example.com" : "Type your answer…"}
                  disabled={sending}
                  rows={1}
                  enterKeyHint="send"
                  autoComplete={
                    requiresEmailResponse
                      ? "email"
                      : isNameQuestionPrompt(event.agentBrief, currentMessage)
                        ? "given-name"
                        : "off"
                  }
                  inputMode={requiresEmailResponse ? "email" : "text"}
                  className="min-h-[48px] max-h-[180px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-3 font-mono text-base font-medium tracking-wide leading-6 text-white placeholder-gray-300 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={
                    sending ||
                    captchaSetupRequired ||
                    (captchaGateActive && !emailCaptchaToken) ||
                    (!inputValue.trim() && !audioBlob && !videoBlob && !allowsMediaResponse)
                  }
                  className="crowdsource-btn-primary sm:min-w-[5.5rem] sm:w-auto"
                >
                  {sending ? "Sending…" : "Submit"}
                </button>
              </div>
              {allowsMediaResponse && (
                <>
                  <p className="text-center font-mono text-base font-medium tracking-wide text-gray-300">or</p>
                  <p className="font-mono text-base font-medium tracking-wide text-gray-300">
                    Record a message (optional)
                  </p>
                  {allowAudioResponse && (
                    <RecordAudio
                      variant="plain"
                      onRecordingReady={setAudioBlob}
                      onClear={() => setAudioBlob(null)}
                    />
                  )}
                  {allowVideoResponse && (
                    <RecordVideo onRecordingReady={setVideoBlob} onClear={() => setVideoBlob(null)} />
                  )}
                </>
              )}
            </div>
          </form>
        </div>
      )}

      {position.phase === "sound_transition" && (
        <div className="space-y-6 text-center">
          <p className="mx-auto max-w-xl font-mono text-base leading-snug text-gray-200 sm:text-lg">
            <TypewriterText
              key="sound-transition"
              text={soundTransitionMessage(event)}
              speed={9}
              className="inline"
            />
          </p>
          <button
            type="button"
            disabled={!transitionReady}
            onClick={handleSoundTransitionContinue}
            className="crowdsource-btn-primary"
          >
            NEXT →
          </button>
        </div>
      )}

      {nameGate && position.phase === "garden" && (
        <div className="space-y-4 text-center">
          <p className="font-mono text-base text-gray-200">What name should we credit on your sounds?</p>
          <input
            type="text"
            value={contributorName}
            onChange={(e) => setContributorName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
            className="crowdsource-field px-4 py-3 font-mono text-base"
          />
          <button
            type="button"
            onClick={handleNameGateContinue}
            className="crowdsource-btn-primary"
          >
            Continue
          </button>
          {chatError && <p className="text-sm text-red-300">{chatError}</p>}
        </div>
      )}

      {position.phase === "garden" && !nameGate && activeGardenStep && (
        <SoundGardenExperience
          key={activeGardenStep.slot.id}
          eventId={event.id}
          mode="single"
          activeSlotId={activeGardenStep.slot.id}
          activeStep={activeGardenStep}
          contributorName={contributorName.trim() || null}
          hideIntro
          hideProgress
          onSlotComplete={handleSlotComplete}
          onDoneSlotsChange={setDoneSlots}
        />
      )}

      {position.phase === "final" && (
        <div className="space-y-6 text-center">
          <p className="mx-auto max-w-md font-mono text-base leading-snug text-gray-200 sm:text-lg">
            <TypewriterText key="journey-final" text={finalMessage} speed={9} className="inline" />
          </p>
          <button
            type="button"
            onClick={handleParticipateAgain}
            disabled={sending}
            className="crowdsource-btn-primary"
          >
            Let&apos;s do it again
          </button>
        </div>
      )}
    </div>
  );
}
