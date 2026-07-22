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
import {
  resolveCategoryLabel,
  resolveJourneySteps,
  resolveSoundStep,
  type JourneyStep,
} from "@/lib/songgarden/journey-steps";
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
  withTimeout,
} from "@/lib/participant-journey/interview-helpers";
import {
  DEFAULT_JOURNEY_FINAL_MESSAGE,
  journeyProgress,
  type JourneyPosition,
} from "@/lib/participant-journey/steps";
import {
  contributionConsentText,
  requiresContributionConsent,
} from "@/lib/participant-journey/contribution-consent";
import { questionResponseHint } from "@/lib/participant-journey/example-words";
import { unlockReferenceTones } from "@/lib/songgarden/reference-tones";
import { pulseHaptic } from "@/lib/song-garden-v2/haptics";
import { requestTiltPermission } from "@/lib/song-garden-v2/tilt";
import { isTurnstileClientConfigured, TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { resolveWorldConfig } from "@/lib/song-garden-v2/world-config";
import {
  appendGrowthNode,
  clearGrowthNodes,
  loadGrowthNodes,
  type WorldGrowthNode,
} from "@/lib/song-garden-v2/growth-nodes";
import {
  COMPLETION_MOMENT_LABEL,
  NAME_MOMENT_LABEL,
  WELCOME_MOMENT_LABEL,
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
    // Migrate legacy lyric/garden positions → restart landing (version bump usually handles this).
    if (saved.phase === "lyric" || saved.phase === "garden" || saved.phase === "sound_transition") {
      return null;
    }
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

function suggestedTypesForStep(step: JourneyStep): AgentNextMessageResponse["suggestedAnswerTypes"] {
  if (step.kind === "name") return ["text"];
  if (step.kind === "sound") return ["text"];
  const types: AgentNextMessageResponse["suggestedAnswerTypes"] = ["text"];
  if (step.allowAudio) types.push("voice");
  if (step.allowVideo) types.push("video");
  if (step.requireEmailCaptcha) {
    types.push("email");
    types.push("captcha");
  }
  return types;
}

/**
 * Song Garden V2 participant orchestrator — runs a unified ordered journey
 * (name / text / sound in any order).
 */
export default function WorldJourney({ event }: WorldJourneyProps) {
  const world = useMemo(() => resolveWorldConfig(event), [event]);
  const interviewVersion = eventInterviewVersion(event);
  const journeySteps = useMemo(() => resolveJourneySteps(event), [event]);

  const [position, setPosition] = useState<JourneyPosition>(() => {
    const saved = loadJourneyPosition(event.id, interviewVersion);
    if (saved) return saved;
    return { phase: "landing", gardenSlotIndex: 0, stepIndex: 0, interviewVersion };
  });

  const [journeyStarted, setJourneyStarted] = useState(position.phase !== "landing");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null);
  const [conversationReady, setConversationReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [emailCaptchaToken, setEmailCaptchaToken] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [contributorName, setContributorName] = useState(
    () => getSonggardenContributorName(event.id) ?? ""
  );
  const [contributionConsentAgreed, setContributionConsentAgreed] = useState(false);
  const requireContributionConsent = requiresContributionConsent(event);
  const contributionConsentLabel = contributionConsentText(event);
  const [worldUnlocked, setWorldUnlocked] = useState(false);
  const [burstMessage, setBurstMessage] = useState("Got it");
  const [growthNodes, setGrowthNodes] = useState<WorldGrowthNode[]>(() => loadGrowthNodes(event.id));

  const growNode = useCallback(
    (kind: WorldGrowthNode["kind"]) => {
      setGrowthNodes(appendGrowthNode(event.id, kind));
    },
    [event.id]
  );

  const responseInputRef = useRef<HTMLTextAreaElement | null>(null);
  const ensuringConversation = useRef(false);
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

  const stepIndex = position.stepIndex ?? 0;
  const activeStep =
    position.phase === "step" && stepIndex >= 0 && stepIndex < journeySteps.length
      ? journeySteps[stepIndex]
      : null;
  const activeSound = activeStep?.kind === "sound" ? resolveSoundStep(activeStep) : null;

  const progress = journeyProgress(event, position);
  const energyLevel = progress.total > 0 ? Math.min(1, progress.completed / progress.total) : 0;
  const showProgress = journeyStarted && position.phase !== "final";

  const currentSuggestedAnswerTypes = activeStep ? suggestedTypesForStep(activeStep) : ["text"];
  const allowAudioResponse = currentSuggestedAnswerTypes.includes("voice");
  const allowVideoResponse = currentSuggestedAnswerTypes.includes("video");
  const requiresEmailResponse = currentSuggestedAnswerTypes.includes("email");
  const requiresCaptchaResponse = currentSuggestedAnswerTypes.includes("captcha");
  const captchaGateActive = requiresCaptchaResponse && isTurnstileClientConfigured();
  const captchaSetupRequired = requiresCaptchaResponse && !isTurnstileClientConfigured();
  const allowsMediaResponse = allowAudioResponse || allowVideoResponse;
  const isNameStep = activeStep?.kind === "name";

  const promptText = useMemo(() => {
    if (!activeStep) return "";
    if (activeStep.kind === "name") {
      return activeStep.prompt?.trim() || "What should we call you?";
    }
    if (activeStep.kind === "text" || activeStep.kind === "sound") {
      return activeStep.prompt;
    }
    return "";
  }, [activeStep]);

  const responseHint = useMemo(
    () => questionResponseHint(promptText, { isName: isNameStep, isEmail: requiresEmailResponse }),
    [promptText, isNameStep, requiresEmailResponse]
  );

  const goToStep = useCallback(
    (index: number) => {
      if (index >= journeySteps.length) {
        setPositionPersisted({ phase: "final", gardenSlotIndex: 0, stepIndex: Math.max(0, journeySteps.length - 1) });
        return;
      }
      const step = journeySteps[index];
      if (step?.kind === "sound") unlockReferenceTones();
      setPositionPersisted({ phase: "step", gardenSlotIndex: 0, stepIndex: index });
      setInputValue("");
      setAudioBlob(null);
      setVideoBlob(null);
      setEmailCaptchaToken(null);
      setChatError(null);
    },
    [journeySteps, setPositionPersisted]
  );

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId && conversationReady) return conversationId;
    if (ensuringConversation.current) return conversationId;
    ensuringConversation.current = true;
    setSending(true);
    try {
      const token = getOrCreateSessionToken(event.id, interviewVersion);
      setActiveSessionToken(token);

      const savedId = findSavedConversationId(event.id, token);
      if (savedId) {
        setConversationId(savedId);
        try {
          const { turns } = await getConversation(savedId);
          const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
          // Prime agent if empty conversation
          if (!lastAgent) {
            await withTimeout(sendMessage(savedId, ""), 20000, "Timed out priming conversation.");
          }
          setConversationReady(true);
          return savedId;
        } catch {
          // fall through to new conversation
        }
      }

      const { conversation } = await withTimeout(
        startAgentInterview(event.id, { sessionToken: token }),
        15000,
        "Timed out while starting. Please try again."
      );
      setConversationId(conversation.id);
      localStorage.setItem(conversationIdKey(event.id, token), conversation.id);
      await withTimeout(sendMessage(conversation.id, ""), 20000, "Timed out while starting the first question.");
      setConversationReady(true);
      return conversation.id;
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Couldn't start");
      return null;
    } finally {
      ensuringConversation.current = false;
      setSending(false);
    }
  }, [conversationId, conversationReady, event.id, interviewVersion]);

  // When landing on a text/name step, ensure agent conversation exists for persistence.
  useEffect(() => {
    if (position.phase !== "step" || !activeStep) return;
    if (activeStep.kind !== "name" && activeStep.kind !== "text") return;
    if (conversationReady) return;
    void ensureConversation();
  }, [position.phase, activeStep, conversationReady, ensureConversation]);

  // Skip already-completed sound steps when resuming.
  useEffect(() => {
    if (position.phase !== "step" || !activeStep || activeStep.kind !== "sound") return;
    const done = loadDoneSlots(event.id);
    if (done.has(activeStep.slotId)) {
      goToStep(stepIndex + 1);
    }
  }, [position.phase, activeStep, event.id, goToStep, stepIndex]);

  // Empty journey → final
  useEffect(() => {
    if (position.phase === "step" && journeySteps.length === 0) {
      setPositionPersisted({ phase: "final", gardenSlotIndex: 0, stepIndex: 0 });
    }
  }, [position.phase, journeySteps.length, setPositionPersisted]);

  async function handleStartJourney(e: FormEvent) {
    e.preventDefault();
    unlockReferenceTones();
    requestTiltPermission();
    setWorldUnlocked(true);
    if (journeyStarted) return;
    if (requireContributionConsent && !contributionConsentAgreed) {
      setChatError("Please confirm how your contributions may be used.");
      return;
    }
    setChatError(null);
    setJourneyStarted(true);
    goToStep(0);
  }

  useEffect(() => {
    setEmailCaptchaToken(null);
  }, [stepIndex]);

  useEffect(() => {
    if (position.phase !== "step" || !activeStep) return;
    if (activeStep.kind !== "name" && activeStep.kind !== "text") return;
    if (sending) return;
    requestAnimationFrame(() => responseInputRef.current?.focus());
  }, [position.phase, activeStep, sending, stepIndex]);

  async function handleTextSubmit(e: FormEvent) {
    e.preventDefault();
    unlockReferenceTones();
    if (!activeStep || (activeStep.kind !== "name" && activeStep.kind !== "text")) return;
    if (sending) return;

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
    if (isNameStep && !inputValue.trim()) {
      setChatError("Please enter a name.");
      return;
    }
    if (!inputValue.trim() && !audioBlob && !videoBlob && !allowsMediaResponse) return;

    const content = inputValue.trim();
    setInputValue("");
    if (responseInputRef.current) responseInputRef.current.style.height = "auto";
    setChatError(null);
    setSending(true);

    try {
      const convId = await ensureConversation();
      if (!convId) {
        setSending(false);
        return;
      }

      const audioDataUrl = audioBlob ? await blobToDataUrl(audioBlob) : null;
      const videoDataUrl = videoBlob ? await blobToDataUrl(videoBlob) : null;
      await sendMessage(convId, content || "(recording)", {
        audioDataUrl,
        videoDataUrl,
        captchaToken: captchaGateActive ? emailCaptchaToken : null,
      });
      setAudioBlob(null);
      setVideoBlob(null);
      setEmailCaptchaToken(null);
      setSending(false);

      if (isNameStep && content) {
        setSonggardenContributorName(event.id, content);
        setContributorName(content);
      }

      growNode(videoDataUrl ? "video" : audioDataUrl ? "voice" : "text");
      pulseHaptic();
      setBurstMessage("Got it");

      celebration.celebrate(() => {
        goToStep(stepIndex + 1);
      });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Submit failed");
      setSending(false);
    }
  }

  const handleSlotSubmitted = useCallback(() => {
    if (!activeSound) return;

    const category = activeSound.slot.category;
    growNode(category === "percussion" ? "percussion" : category === "vocal" ? "vocal" : "other");
    pulseHaptic();
    setBurstMessage("Added to the song garden");

    celebration.celebrate(() => {
      goToStep(stepIndex + 1);
    });
  }, [activeSound, celebration, goToStep, growNode, stepIndex]);

  function handleParticipateAgain() {
    clearJourneySession(event, interviewVersion, activeSessionToken);
    clearDoneSlots(event.id);
    clearGrowthNodes(event.id);
    setGrowthNodes([]);
    ensuringConversation.current = false;
    setJourneyStarted(false);
    setPosition({ phase: "landing", gardenSlotIndex: 0, stepIndex: 0, interviewVersion });
    setContributionConsentAgreed(false);
    setConversationId(null);
    setActiveSessionToken(null);
    setConversationReady(false);
    setChatError(null);
    setInputValue("");
    setSending(false);
    setAudioBlob(null);
    setVideoBlob(null);
  }

  // Sound step without contributor name — brief name gate
  const needsNameGate =
    position.phase === "step" &&
    activeStep?.kind === "sound" &&
    !contributorName.trim();

  const [nameGateValue, setNameGateValue] = useState("");
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

  const finalMessage = event.anthemCompletionMessage?.trim() || DEFAULT_JOURNEY_FINAL_MESSAGE;
  const momentKey = needsNameGate
    ? "name-gate"
    : `${position.phase}:${stepIndex}:${activeStep?.kind ?? ""}:${promptText}`;

  let eyebrow: string | undefined;
  if (position.phase === "landing") eyebrow = WELCOME_MOMENT_LABEL;
  else if (needsNameGate) eyebrow = NAME_MOMENT_LABEL;
  else if (activeStep) eyebrow = resolveCategoryLabel(activeStep);
  else if (position.phase === "final") eyebrow = COMPLETION_MOMENT_LABEL;

  return (
    <WorldStage
      world={world}
      eventId={event.id}
      energyLevel={energyLevel}
      celebrationTrigger={celebration.trigger}
      soundtrackUnlocked={worldUnlocked}
      growthNodes={growthNodes}
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

      {/* Hide prompt UI instantly while celebrating so the burst isn't overlaid on the question. */}
      {!celebration.active ? (
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
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 px-6 py-3 font-mono text-base font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: world.accentColor,
                    color: world.accentColor,
                    background: `${world.accentColor}1f`,
                  }}
                >
                  {sending ? "Starting…" : event.ctaText || DEFAULT_CTA_TEXT}
                </button>
              </form>
              {chatError && <p className="text-center font-mono text-sm text-red-300">{chatError}</p>}
            </div>
          )}

          {position.phase === "step" && (activeStep?.kind === "name" || activeStep?.kind === "text") && (
            <div className="space-y-5">
              {chatError && (
                <p className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                  {chatError}
                </p>
              )}
              <div className="min-h-[3rem] text-center">
                {sending && !conversationReady ? (
                  <SpinnerDots accentColor={world.accentColor} />
                ) : (
                  <>
                    <p className="mx-auto max-w-xl font-mono text-[1.0625rem] leading-snug text-white sm:text-lg">
                      {displayPrompt(promptText)}
                    </p>
                    {responseHint && (
                      <p className="mt-2 font-mono text-sm" style={{ color: world.accentColor }}>
                        {responseHint}
                      </p>
                    )}
                  </>
                )}
              </div>

              <form onSubmit={handleTextSubmit} aria-busy={sending} className="space-y-4">
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
                  autoComplete={requiresEmailResponse ? "email" : isNameStep ? "given-name" : "off"}
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

          {position.phase === "step" && activeStep?.kind === "sound" && needsNameGate && (
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

          {position.phase === "step" && activeStep?.kind === "sound" && !needsNameGate && activeSound && (
            <SoundMomentPad
              key={activeSound.slot.id}
              eventId={event.id}
              slot={activeSound.slot}
              promptText={activeSound.prompt}
              buttonLabel={activeSound.buttonLabel}
              contributorName={contributorName.trim() || null}
              accentColor={world.accentColor}
              alternateSlots={activeSound.alternateSlots}
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
      ) : (
        <div className="mx-auto w-full min-h-0 max-w-lg flex-1" aria-hidden />
      )}

      <CelebrationBurst
        active={celebration.active}
        accentColor={world.accentColor}
        message={burstMessage}
      />
    </WorldStage>
  );
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
