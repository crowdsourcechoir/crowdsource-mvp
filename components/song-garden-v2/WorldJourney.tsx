"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Event } from "@/data/mockEvents";
import RecordAudio from "@/components/RecordAudio";
import RecordVideo from "@/components/RecordVideo";
import TurnstileWidget from "@/components/TurnstileWidget";
import {
  startAgentInterview,
  getConversation,
  sendMessage,
  type AgentNextMessageResponse,
} from "@/data/agentInterview";
import {
  grantSonggardenAccess,
  getSonggardenContributorName,
  setSonggardenContributorName,
} from "@/data/songgardenClient";
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
import { isNameQuestionPrompt } from "@/lib/agent-name-question";
import {
  contributionConsentText,
  requiresContributionConsent,
} from "@/lib/participant-journey/contribution-consent";
import { questionResponseHint } from "@/lib/participant-journey/example-words";
import { unlockReferenceTones } from "@/lib/songgarden/reference-tones";
import { isTurnstileClientConfigured, TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { resolveWorldConfig } from "@/lib/song-garden-v2/world-config";
import {
  COMPLETION_MOMENT_LABEL,
  LYRIC_MOMENT_LABEL,
  NAME_MOMENT_LABEL,
  TRANSITION_MOMENT_LABEL,
  WELCOME_MOMENT_LABEL,
  gardenSlotMomentLabel,
} from "@/lib/song-garden-v2/moment-labels";
import WorldStage from "./WorldStage";
import MomentOverlay from "./MomentOverlay";
import WorldProgressTrail from "./WorldProgressTrail";
import ContributionTextField from "./ContributionTextField";
import SoundMomentPad from "./SoundMomentPad";
import CelebrationBurst from "./CelebrationBurst";
import { useCelebration } from "./engine/useCelebration";

type WorldJourneyProps = {
  event: Event;
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
    if (sessionToken) localStorage.removeItem(conversationIdKey(event.id, sessionToken));
    localStorage.removeItem(sessionTokenKey(event.id, interviewVersion));
    localStorage.removeItem(journeyPositionKey(event.id));
  } catch {
    // ignore
  }
}

/**
 * Song Garden V2 participant orchestrator. Same phase machine and backend calls as
 * components/participant-journey/ParticipantJourney.tsx — only the presentation
 * layer (World Stage + Interaction Engine + Celebration) is new.
 */
export default function WorldJourney({ event }: WorldJourneyProps) {
  const world = useMemo(() => resolveWorldConfig(event), [event]);
  const interviewVersion = eventInterviewVersion(event);
  const gardenSteps = useMemo(() => getEnabledGardenSteps(event), [event]);

  const [position, setPosition] = useState<JourneyPosition>(() => {
    const saved = loadJourneyPosition(event.id, interviewVersion);
    if (saved) return saved;
    return { phase: "landing", gardenSlotIndex: 0, interviewVersion };
  });
  const [lyricQuestionIndex, setLyricQuestionIndex] = useState(0);
  const [doneSlots, setDoneSlots] = useState<Set<GardenSlotId>>(() => loadDoneSlots(event.id));

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
  const [nameGateValue, setNameGateValue] = useState("");
  const [contributionConsentAgreed, setContributionConsentAgreed] = useState(false);
  const requireContributionConsent = requiresContributionConsent(event);
  const contributionConsentLabel = contributionConsentText(event);
  const [worldUnlocked, setWorldUnlocked] = useState(false);

  const firstMessageRequested = useRef(false);
  const responseInputRef = useRef<HTMLTextAreaElement | null>(null);

  const celebration = useCelebration();

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

  const progress = journeyProgress(event, position, lyricQuestionIndex);
  const energyLevel = progress.total > 0 ? Math.min(1, progress.completed / progress.total) : 0;
  const showProgress = journeyStarted && position.phase !== "final";

  const enterSoundTransition = useCallback(() => {
    // No sound-garden slots enabled for this event — skip the transition/garden
    // moments entirely rather than stranding the participant on an empty overlay.
    if (gardenSteps.length === 0) {
      setPositionPersisted({ phase: "final", gardenSlotIndex: 0 });
      return;
    }
    setPositionPersisted({ phase: "sound_transition", gardenSlotIndex: 0 });
  }, [gardenSteps.length, setPositionPersisted]);

  const activeGardenStep = position.phase === "garden" ? gardenSteps[position.gardenSlotIndex] : null;

  // Safety net: if we ever land in "garden" with no enabled steps (e.g. a
  // stale persisted position from before steps were disabled in admin, or a
  // race in the transitions above), fall through to completion instead of
  // showing a permanently empty moment overlay.
  useEffect(() => {
    if (position.phase === "garden" && gardenSteps.length === 0) {
      setPositionPersisted({ phase: "final", gardenSlotIndex: 0 });
    }
  }, [position.phase, gardenSteps.length, setPositionPersisted]);

  const allowAudioResponse = currentSuggestedAnswerTypes.includes("voice");
  const allowVideoResponse = currentSuggestedAnswerTypes.includes("video");
  const requiresEmailResponse = currentSuggestedAnswerTypes.includes("email");
  const requiresCaptchaResponse = currentSuggestedAnswerTypes.includes("captcha");
  const captchaGateActive = requiresCaptchaResponse && isTurnstileClientConfigured();
  const captchaSetupRequired = requiresCaptchaResponse && !isTurnstileClientConfigured();
  const allowsMediaResponse = allowAudioResponse || allowVideoResponse;

  const isNameQuestion = isNameQuestionPrompt(event.agentBrief, currentMessage);
  const responseHint = useMemo(
    () => questionResponseHint(currentMessage, { isName: isNameQuestion, isEmail: requiresEmailResponse }),
    [currentMessage, isNameQuestion, requiresEmailResponse]
  );

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
        startAgentInterview(event.id, { sessionToken: token }),
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
    unlockReferenceTones();
    setWorldUnlocked(true);
    if (journeyStarted) return;
    if (requireContributionConsent && !contributionConsentAgreed) {
      setChatError("Please confirm how your contributions may be used.");
      return;
    }
    await beginLyricPhase();
  }

  // Rehydrate conversation after refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (conversationId || position.phase === "landing" || position.phase === "final") return;
    if (position.phase === "garden" || position.phase === "sound_transition") return;

    const token = getOrCreateSessionToken(event.id, interviewVersion);
    const savedConversationId = findSavedConversationId(event.id, token);
    if (!savedConversationId) {
      if (position.phase === "lyric") {
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
              setPositionPersisted({ phase: "final", gardenSlotIndex: Math.max(0, gardenSteps.length - 1) });
            } else if (position.phase === "lyric") {
              enterSoundTransition();
            }
          } else {
            setPositionPersisted({ phase: "lyric", gardenSlotIndex: 0 });
          }
        }
      })
      .catch((err) => setChatError(err instanceof Error ? err.message : "Failed to load progress"))
      .finally(() => setSending(false));
  }, [conversationId, event, gardenSteps.length, interviewVersion, position.phase, setPositionPersisted, enterSoundTransition]);

  // First agent message.
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
        const res = await withTimeout(sendMessage(conversationId, ""), 20000, "Timed out while starting the first question.");
        if (cancelled) return;
        setCurrentMessage(res.nextMessage.agentMessage);
        setCurrentSuggestedAnswerTypes(res.nextMessage.suggestedAnswerTypes ?? ["text"]);
        setLyricQuestionIndex(1);
        if (res.nextMessage.stopReason === "finished") {
          setChatFinished(true);
          enterSoundTransition();
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
            enterSoundTransition();
          }
        } catch {
          // ignore
        }
        if (!recovered) firstMessageRequested.current = false;
      } finally {
        if (!cancelled) setSending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, currentMessage, enterSoundTransition, event, position.phase]);

  useEffect(() => {
    setEmailCaptchaToken(null);
  }, [currentMessage]);

  useEffect(() => {
    if (position.phase !== "lyric" || chatFinished || sending) return;
    focusResponseInput();
  }, [position.phase, currentMessage, chatFinished, sending]);

  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    unlockReferenceTones();
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
      setSending(false);

      if (answeredNameQuestion && content) {
        setSonggardenContributorName(event.id, content);
        setContributorName(content);
      }

      celebration.celebrate(() => {
        if (res.nextMessage.stopReason === "finished") {
          setChatFinished(true);
          setCurrentMessage(null);
          enterSoundTransition();
        } else {
          setLyricQuestionIndex((n) => n + 1);
          setCurrentMessage(res.nextMessage.agentMessage);
          setCurrentSuggestedAnswerTypes(res.nextMessage.suggestedAnswerTypes ?? ["text"]);
        }
      });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Submit failed");
      setSending(false);
    } finally {
      if (!chatFinished) focusResponseInput();
    }
  }

  function handleSoundTransitionContinue() {
    unlockReferenceTones();
    const done = loadDoneSlots(event.id);
    setDoneSlots(done);
    if (gardenSteps.length === 0) {
      setPositionPersisted({ phase: "final", gardenSlotIndex: 0 });
      return;
    }
    setPositionPersisted({ phase: "garden", gardenSlotIndex: firstIncompleteGardenIndex(event, done) });
  }

  function handleNameGateContinue() {
    const trimmed = nameGateValue.trim();
    if (!trimmed) {
      setChatError("Please add your name so we can credit your sounds.");
      return;
    }
    setSonggardenContributorName(event.id, trimmed);
    setContributorName(trimmed);
    setChatError(null);
  }

  const handleSlotSubmitted = useCallback(() => {
    if (!activeGardenStep) return;
    const updated = loadDoneSlots(event.id);
    setDoneSlots(updated);
    const currentIndex = gardenSteps.findIndex((step) => step.slot.id === activeGardenStep.slot.id);
    const nextIndex = currentIndex + 1;

    celebration.celebrate(() => {
      if (nextIndex >= gardenSteps.length) {
        setPositionPersisted({ phase: "final", gardenSlotIndex: Math.max(0, gardenSteps.length - 1) });
      } else {
        setPositionPersisted({ phase: "garden", gardenSlotIndex: nextIndex });
      }
    });
  }, [activeGardenStep, celebration, event.id, gardenSteps, setPositionPersisted]);

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

  const finalMessage = event.anthemCompletionMessage?.trim() || DEFAULT_JOURNEY_FINAL_MESSAGE;
  const needsNameGate = position.phase === "garden" && !contributorName.trim();
  const momentKey = needsNameGate ? "name-gate" : `${position.phase}:${position.gardenSlotIndex}:${lyricQuestionIndex}:${currentMessage ?? ""}`;

  let eyebrow: string | undefined;
  if (position.phase === "landing") eyebrow = WELCOME_MOMENT_LABEL;
  else if (needsNameGate) eyebrow = NAME_MOMENT_LABEL;
  else if (position.phase === "lyric") eyebrow = isNameQuestion ? NAME_MOMENT_LABEL : LYRIC_MOMENT_LABEL;
  else if (position.phase === "sound_transition") eyebrow = TRANSITION_MOMENT_LABEL;
  else if (position.phase === "garden" && activeGardenStep) eyebrow = gardenSlotMomentLabel(activeGardenStep.slot.id);
  else if (position.phase === "final") eyebrow = COMPLETION_MOMENT_LABEL;

  return (
    <WorldStage
      world={world}
      energyLevel={energyLevel}
      celebrationTrigger={celebration.trigger}
      soundtrackUnlocked={worldUnlocked}
    >
      <header className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] text-center">
        {world.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={world.logoUrl} alt="" className="mx-auto mb-2 h-8 w-auto opacity-90" />
        ) : null}
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: world.accentColor, opacity: 0.85 }}
        >
          {world.title}
        </p>
        {showProgress && (
          <div className="mt-3">
            <WorldProgressTrail completed={progress.completed} total={progress.total} accentColor={world.accentColor} />
          </div>
        )}
      </header>

      <MomentOverlay momentKey={momentKey} eyebrow={eyebrow} accentColor={world.accentColor}>
        {position.phase === "landing" && (
          <div className="space-y-5 text-center">
            <p className="mx-auto max-w-xl font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
              {event.landingHeadline || DEFAULT_OPENING_PROMPT}
            </p>
            {!!event.landingCopy && (
              <p className="mx-auto max-w-xl font-mono text-sm text-gray-300">{event.landingCopy}</p>
            )}
            <form onSubmit={handleStartJourney} className="space-y-4">
              {requireContributionConsent && (
                <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={contributionConsentAgreed}
                    onChange={(e) => setContributionConsentAgreed(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0"
                    style={{ accentColor: world.accentColor }}
                  />
                  <span className="font-mono text-sm text-gray-200">{contributionConsentLabel}</span>
                </label>
              )}
              <button
                type="submit"
                disabled={sending || (requireContributionConsent && !contributionConsentAgreed)}
                className="flex min-h-[52px] w-full items-center justify-center rounded-2xl px-6 py-3 font-mono text-base font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: world.accentColor, color: "#1a1530" }}
              >
                {sending ? "Starting…" : event.ctaText || DEFAULT_CTA_TEXT}
              </button>
            </form>
            {chatError && <p className="text-center font-mono text-sm text-red-300">{chatError}</p>}
          </div>
        )}

        {position.phase === "lyric" && (
          <div className="space-y-5">
            {chatError && <p className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">{chatError}</p>}
            <div className="min-h-[3rem] text-center">
              {sending && !currentMessage ? (
                <SpinnerDots accentColor={world.accentColor} />
              ) : currentMessage ? (
                <>
                  <p className="mx-auto max-w-xl font-mono text-[1.0625rem] leading-snug text-white sm:text-lg">
                    {displayPrompt(currentMessage)}
                  </p>
                  {responseHint && (
                    <p className="mt-2 font-mono text-sm" style={{ color: world.accentColor }}>
                      {responseHint}
                    </p>
                  )}
                </>
              ) : (
                <SpinnerDots accentColor={world.accentColor} />
              )}
            </div>

            <form onSubmit={handleChatSubmit} aria-busy={sending} className="space-y-4">
              {captchaSetupRequired && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 font-mono text-xs text-amber-100">
                  Email captcha requires Turnstile keys in .env.local.
                </p>
              )}
              {captchaGateActive && (
                <div className="flex flex-col items-center gap-2">
                  <p className="font-mono text-sm text-gray-300">Quick verification — then submit your email.</p>
                  <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setEmailCaptchaToken} />
                </div>
              )}
              <ContributionTextField
                value={inputValue}
                onChange={setInputValue}
                onSubmit={() => responseInputRef.current?.form?.requestSubmit()}
                placeholder={requiresEmailResponse ? "you@example.com" : "Type your answer…"}
                disabled={sending}
                submitDisabled={
                  sending ||
                  captchaSetupRequired ||
                  (captchaGateActive && !emailCaptchaToken) ||
                  (!inputValue.trim() && !audioBlob && !videoBlob && !allowsMediaResponse)
                }
                submitLabel={sending ? "Sending…" : "Continue →"}
                accentColor={world.accentColor}
                inputMode={requiresEmailResponse ? "email" : "text"}
                autoComplete={requiresEmailResponse ? "email" : isNameQuestion ? "given-name" : "off"}
                inputRef={(el) => (responseInputRef.current = el)}
              />
              {allowsMediaResponse && (
                <div className="space-y-2 text-center">
                  <p className="font-mono text-sm text-gray-300">or record a message (optional)</p>
                  {allowAudioResponse && (
                    <RecordAudio variant="plain" onRecordingReady={setAudioBlob} onClear={() => setAudioBlob(null)} />
                  )}
                  {allowVideoResponse && (
                    <RecordVideo onRecordingReady={setVideoBlob} onClear={() => setVideoBlob(null)} />
                  )}
                </div>
              )}
            </form>
          </div>
        )}

        {position.phase === "sound_transition" && (
          <div className="space-y-6 text-center">
            <p className="mx-auto max-w-xl font-mono text-base leading-snug text-gray-100 sm:text-lg">
              {soundTransitionMessage(event)}
            </p>
            <button
              type="button"
              onClick={handleSoundTransitionContinue}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl px-6 py-3 font-mono text-base font-semibold tracking-wide"
              style={{ background: world.accentColor, color: "#1a1530" }}
            >
              Next →
            </button>
          </div>
        )}

        {position.phase === "garden" && needsNameGate && (
          <div className="space-y-4">
            <p className="text-center font-mono text-base text-gray-100">
              What name should we credit on your sounds?
            </p>
            <ContributionTextField
              value={nameGateValue}
              onChange={setNameGateValue}
              onSubmit={handleNameGateContinue}
              placeholder="First name"
              autoComplete="given-name"
              submitLabel="Continue"
              accentColor={world.accentColor}
            />
            {chatError && <p className="text-center text-sm text-red-300">{chatError}</p>}
          </div>
        )}

        {position.phase === "garden" && !needsNameGate && activeGardenStep && (
          <SoundMomentPad
            key={activeGardenStep.slot.id}
            eventId={event.id}
            slot={activeGardenStep.slot}
            promptText={activeGardenStep.prompt}
            buttonLabel={activeGardenStep.buttonLabel}
            contributorName={contributorName.trim() || null}
            accentColor={world.accentColor}
            onSubmitted={handleSlotSubmitted}
          />
        )}

        {position.phase === "final" && (
          <div className="space-y-6 text-center">
            <p className="mx-auto max-w-md font-mono text-base leading-snug text-gray-100 sm:text-lg">{finalMessage}</p>
            <button
              type="button"
              onClick={handleParticipateAgain}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border px-6 py-3 font-mono text-base font-semibold tracking-wide"
              style={{ borderColor: world.accentColor, color: world.accentColor }}
            >
              Let&apos;s do it again
            </button>
          </div>
        )}
      </MomentOverlay>

      <CelebrationBurst active={celebration.active} accentColor={world.accentColor} message={celebrationMessage(position.phase)} />
    </WorldStage>
  );
}

function celebrationMessage(phase: JourneyPosition["phase"]): string {
  switch (phase) {
    case "garden":
      return "Added to the world";
    default:
      return "Got it";
  }
}

function SpinnerDots({ accentColor }: { accentColor: string }) {
  return (
    <span
      className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-solid"
      style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: accentColor }}
      role="status"
      aria-label="Loading"
    />
  );
}
