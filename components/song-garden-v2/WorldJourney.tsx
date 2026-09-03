"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Event } from "@/data/mockEvents";
import TypewriterText from "@/components/TypewriterText";
import {
  startAgentInterview,
  getConversation,
  sendMessage,
  type AgentNextMessageResponse,
} from "@/data/agentInterview";
import {
  grantSonggardenAccess,
  getOrCreateSonggardenDeviceId,
  getSonggardenContributorName,
  setSonggardenContributorName,
} from "@/data/songgardenClient";
import { loadDoneSlots, loadDoneSoundStepIds, clearDoneSlots, saveDoneSlot, saveDoneSoundStepId } from "@/lib/songgarden/garden-storage";
import {
  isAgentContributionStep,
  normalizePromptChannels,
  resolveCategoryLabel,
  resolveJourneySteps,
  resolvePromptRecordMs,
  resolveSoundStep,
  resolveTiedStoryboardFrameIndex,
  type JourneyStep,
} from "@/lib/songgarden/journey-steps";
import { isCompletionButtonVisible } from "@/lib/songgarden/config";
import { uploadTurnMedia } from "@/lib/agent-media/direct-upload-client";
import {
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
import {
  DEFAULT_NAME_RESPONSE_HINT,
  questionResponseHint,
} from "@/lib/participant-journey/example-words";
import { unlockReferenceTones } from "@/lib/songgarden/reference-tones";
import { pulseHaptic } from "@/lib/song-garden-v2/haptics";
import { requestTiltPermission } from "@/lib/song-garden-v2/tilt";
import { isTurnstileClientConfigured, TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { resolveWorldConfig } from "@/lib/song-garden-v2/world-config";
import { worldConfigFromBrand } from "@/lib/song-garden-v2/garden/snapshot";
import { useGardenSnapshot } from "@/lib/song-garden-v2/garden/use-garden-snapshot";
import { writeWorldThemeCache, firstWorldSceneUrl } from "@/lib/song-garden-v2/world-theme-cache";
import {
  appendGrowthNode,
  clearGrowthNodes,
  loadGrowthNodes,
  type WorldGrowthNode,
} from "@/lib/song-garden-v2/growth-nodes";
import {
  COMPLETION_MOMENT_LABEL,
  DEFAULT_COMPLETION_BUTTON_TEXT,
  WELCOME_MOMENT_LABEL,
} from "@/lib/song-garden-v2/moment-labels";
import WorldStage from "./WorldStage";
import MomentOverlay from "./MomentOverlay";
import WorldPresenceTicker from "./WorldPresenceTicker";
import WorldBloomLogo from "./WorldBloomLogo";
import TextMomentPad from "./TextMomentPad";
import { useCelebration } from "./engine/useCelebration";

const TurnstileWidget = dynamic(() => import("@/components/TurnstileWidget"), { ssr: false });
const SoundMomentPad = dynamic(() => import("./SoundMomentPad"), { ssr: false });
const VideoMomentPad = dynamic(() => import("./VideoMomentPad"), { ssr: false });
const CelebrationBurst = dynamic(() => import("./CelebrationBurst"), { ssr: false });

type WorldJourneyProps = {
  event: Event;
};

type AnswerChannel = "text" | "audio" | "video";

const CHANNEL_LABELS: Record<AnswerChannel, string> = {
  text: "Type",
  audio: "Record",
  video: "Video",
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
  if (step.kind === "prompt") {
    const channels = normalizePromptChannels(step);
    const types: AgentNextMessageResponse["suggestedAnswerTypes"] = [];
    if (channels.allowText) types.push("text");
    // Audio plants in the garden — not an agent-interview voice turn.
    if (channels.allowVideo) types.push("video");
    if (channels.allowText && step.requireEmailCaptcha) {
      types.push("email");
      types.push("captcha");
    }
    return types.length > 0 ? types : ["text"];
  }
  return ["text"];
}

/**
 * Song Garden V2 participant orchestrator — runs a unified ordered journey
 * (name / text / sound in any order).
 */
export default function WorldJourney({ event }: WorldJourneyProps) {
  const baseWorld = useMemo(() => resolveWorldConfig(event), [event]);
  const gardenSnap = useGardenSnapshot(event.id);
  const world = useMemo(
    () =>
      gardenSnap.linked && gardenSnap.snapshot
        ? worldConfigFromBrand(gardenSnap.snapshot.brand, baseWorld)
        : baseWorld,
    [baseWorld, gardenSnap.linked, gardenSnap.snapshot]
  );
  const interviewVersion = eventInterviewVersion(event);
  const journeySteps = useMemo(() => resolveJourneySteps(event), [event]);
  const journeyManaged = journeySteps.length > 0;

  useEffect(() => {
    if (!event.slug) return;
    writeWorldThemeCache(event.slug, {
      primaryColor: world.primaryColor,
      accentColor: world.accentColor,
      firstSceneUrl: firstWorldSceneUrl(world),
    });
  }, [event.slug, world]);

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
  const [inputValue, setInputValue] = useState("");
  const [contributorName, setContributorName] = useState(
    () => getSonggardenContributorName(event.id) ?? ""
  );
  const [contributionConsentAgreed, setContributionConsentAgreed] = useState(false);
  const requireContributionConsent = requiresContributionConsent(event);
  const contributionConsentLabel = contributionConsentText(event);
  const [worldUnlocked, setWorldUnlocked] = useState(false);
  const [burstMessage, setBurstMessage] = useState("Got it");
  const [localGrowthNodes, setLocalGrowthNodes] = useState<WorldGrowthNode[]>(() =>
    loadGrowthNodes(event.id)
  );
  const [selectedChannel, setSelectedChannel] = useState<AnswerChannel | null>(null);

  const growthNodes = useMemo((): WorldGrowthNode[] => {
    if (!gardenSnap.linked || !gardenSnap.snapshot) return localGrowthNodes;
    const markIndexes = new Set(gardenSnap.snapshot.myMarks.map((m) => m.index));
    const shared = gardenSnap.snapshot.state.field.nodes.map((n) => ({
      id: `shared_${n.id}`,
      kind: n.kind,
      index: n.index,
      createdAt: Date.parse(n.createdAt) || Date.now(),
      emphasis: "shared" as const,
    }));
    const personal = gardenSnap.snapshot.myMarks.map((m) => ({
      id: `mark_${m.id}`,
      kind: m.kind,
      index: m.index,
      createdAt: Date.parse(m.createdAt) || Date.now(),
      emphasis: "personal" as const,
    }));
    const optimistic = localGrowthNodes.filter(
      (n) => n.id.startsWith("local_") && !markIndexes.has(n.index)
    );
    return [...shared, ...personal, ...optimistic];
  }, [gardenSnap.linked, gardenSnap.snapshot, localGrowthNodes]);

  const growNode = useCallback(
    (kind: WorldGrowthNode["kind"]) => {
      if (gardenSnap.linked) {
        // Optimistic personal spark while snapshot refreshes from the server.
        setLocalGrowthNodes((prev) => [
          ...prev.filter((n) => n.id.startsWith("local_")),
          {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind,
            index: (gardenSnap.snapshot?.state.field.nextIndex ?? prev.length) + prev.length,
            createdAt: Date.now(),
            emphasis: "personal",
          },
        ]);
        return;
      }
      setLocalGrowthNodes(appendGrowthNode(event.id, kind));
    },
    [event.id, gardenSnap.linked, gardenSnap.snapshot]
  );

  const responseInputRef = useRef<HTMLTextAreaElement | null>(null);
  const ensuringConversation = useRef(false);
  const celebration = useCelebration();

  // Drop optimistic locals once the server snapshot catches up.
  useEffect(() => {
    if (!gardenSnap.linked || !gardenSnap.snapshot) return;
    setLocalGrowthNodes((prev) => {
      if (!prev.some((n) => n.id.startsWith("local_"))) return prev;
      return prev.filter((n) => !n.id.startsWith("local_"));
    });
  }, [gardenSnap.linked, gardenSnap.snapshot?.garden.worldVersion]);

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
  const activeSound =
    activeStep?.kind === "prompt" ? resolveSoundStep(activeStep) : null;

  const progress = journeyProgress(event, position);
  const personalEnergy =
    progress.total > 0 ? Math.min(1, progress.completed / progress.total) : 0;
  /** Shared garden bloom when linked; otherwise personal journey energy (V2). */
  const energyLevel =
    gardenSnap.linked && gardenSnap.snapshot
      ? gardenSnap.snapshot.state.energy
      : personalEnergy;

  /**
   * Prompt-tied background: last explicit frame binding through the current step.
   * Null = auto bucket by energy. Skipped when garden-linked shared bloom drives energy.
   */
  const tiedStoryboardFrameIndex = useMemo(() => {
    if (gardenSnap.linked) return null;
    if (position.phase === "landing") return null;
    if (position.phase === "final") {
      return resolveTiedStoryboardFrameIndex(journeySteps, journeySteps.length - 1);
    }
    return resolveTiedStoryboardFrameIndex(journeySteps, stepIndex);
  }, [gardenSnap.linked, position.phase, journeySteps, stepIndex]);

  const showProgress = journeyStarted && position.phase !== "final";

  const currentSuggestedAnswerTypes = activeStep ? suggestedTypesForStep(activeStep) : ["text"];
  const requiresEmailResponse = currentSuggestedAnswerTypes.includes("email");
  const requiresCaptchaResponse = currentSuggestedAnswerTypes.includes("captcha");
  const captchaGateActive = requiresCaptchaResponse && isTurnstileClientConfigured();
  const captchaSetupRequired = requiresCaptchaResponse && !isTurnstileClientConfigured();
  const isNameStep = activeStep?.kind === "name";
  const promptChannels =
    activeStep?.kind === "prompt" ? normalizePromptChannels(activeStep) : null;

  const availableChannels = useMemo((): AnswerChannel[] => {
    if (isNameStep) return ["text"];
    if (!promptChannels) return [];
    const channels: AnswerChannel[] = [];
    if (promptChannels.allowText) channels.push("text");
    if (promptChannels.allowAudio) channels.push("audio");
    if (promptChannels.allowVideo) channels.push("video");
    return channels;
  }, [isNameStep, promptChannels]);

  const activeChannel =
    availableChannels.length === 1 ? availableChannels[0] : selectedChannel;
  const showChannelChooser =
    position.phase === "step" && availableChannels.length > 1 && !selectedChannel;
  const useTextPad = activeChannel === "text";
  const useAudioPad = activeChannel === "audio" && Boolean(activeSound);
  const useVideoPad = activeChannel === "video";
  const showMomentPad = useTextPad || useVideoPad;

  const promptText = useMemo(() => {
    if (!activeStep) return "";
    if (activeStep.kind === "name") {
      return activeStep.prompt?.trim() || "What should we call you?";
    }
    if (activeStep.kind === "prompt") {
      return activeStep.prompt;
    }
    return "";
  }, [activeStep]);

  const responseHint = useMemo(() => {
    if (!useTextPad) return null;
    if (isNameStep && activeStep?.kind === "name") {
      const custom = activeStep.responseHint?.trim();
      return custom || DEFAULT_NAME_RESPONSE_HINT;
    }
    return questionResponseHint(promptText, {
      isName: isNameStep,
      isEmail: requiresEmailResponse,
    });
  }, [promptText, isNameStep, requiresEmailResponse, useTextPad, activeStep]);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= journeySteps.length) {
        setPositionPersisted({ phase: "final", gardenSlotIndex: 0, stepIndex: Math.max(0, journeySteps.length - 1) });
        return;
      }
      const step = journeySteps[index];
      if (step?.kind === "prompt" && normalizePromptChannels(step).allowAudio) {
        unlockReferenceTones();
      }
      setPositionPersisted({ phase: "step", gardenSlotIndex: 0, stepIndex: index });
      setInputValue("");
      setSelectedChannel(null);
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
          if (!lastAgent && !journeyManaged) {
            await withTimeout(
              sendMessage(savedId, "", { journeyManaged: false }),
              20000,
              "Timed out priming conversation."
            );
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
      if (!journeyManaged) {
        await withTimeout(
          sendMessage(conversation.id, "", { journeyManaged: false }),
          20000,
          "Timed out while starting the first question."
        );
      }
      setConversationReady(true);
      return conversation.id;
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Couldn't start");
      return null;
    } finally {
      ensuringConversation.current = false;
      setSending(false);
    }
  }, [conversationId, conversationReady, event.id, interviewVersion, journeyManaged]);

  // When landing on a contribution step, ensure agent conversation exists for persistence.
  useEffect(() => {
    if (position.phase !== "step" || !activeStep) return;
    if (!isAgentContributionStep(activeStep)) return;
    if (conversationReady) return;
    void ensureConversation();
  }, [position.phase, activeStep, conversationReady, ensureConversation]);

  // Skip already-completed audio steps when resuming.
  useEffect(() => {
    if (position.phase !== "step" || !activeStep || activeStep.kind !== "prompt") return;
    if (!normalizePromptChannels(activeStep).allowAudio) return;
    if (activeStep.slotId) {
      const done = loadDoneSlots(event.id);
      if (done.has(activeStep.slotId)) goToStep(stepIndex + 1);
      return;
    }
    // Open (uncategorized) audio tracks by journey step id.
    if (loadDoneSoundStepIds(event.id).has(activeStep.id)) {
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
    if (!useTextPad) return;
    if (sending) return;
    requestAnimationFrame(() => responseInputRef.current?.focus());
  }, [position.phase, activeStep, sending, stepIndex, useTextPad]);

  async function handleTextSubmit() {
    unlockReferenceTones();
    if (!activeStep || (activeStep.kind !== "name" && activeStep.kind !== "prompt")) return;
    if (sending) return;

    const textValue = inputValue.trim();
    if (!textValue) {
      setChatError(isNameStep ? "Please enter a name." : "Add a response to continue.");
      return;
    }

    if (requiresEmailResponse && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textValue)) {
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

      const sent = await sendMessage(convId, textValue, {
        captchaToken: captchaGateActive ? emailCaptchaToken : null,
        deviceId: getOrCreateSonggardenDeviceId(),
        journeyManaged,
        journeyNameStep: isNameStep,
      });
      setEmailCaptchaToken(null);
      setSending(false);

      if (isNameStep) {
        setSonggardenContributorName(event.id, textValue);
        setContributorName(textValue);
      }

      growNode("text");
      pulseHaptic();
      setBurstMessage(sent.gardenCelebrationLine?.trim() || "Got it");
      if (gardenSnap.linked) void gardenSnap.refresh();

      celebration.celebrate(() => {
        goToStep(stepIndex + 1);
      });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Submit failed");
      setSending(false);
    }
  }

  const handleSlotSubmitted = useCallback(
    (meta?: { gardenCelebrationLine?: string | null }) => {
      if (!activeSound) return;

      if (activeSound.isFree) {
        saveDoneSoundStepId(event.id, activeSound.id);
      }

      const category = activeSound.slot.category;
      growNode(category === "percussion" ? "percussion" : category === "vocal" ? "vocal" : "other");
      pulseHaptic();
      setBurstMessage(meta?.gardenCelebrationLine?.trim() || "Added to the song garden");
      if (gardenSnap.linked) void gardenSnap.refresh();

      celebration.celebrate(() => {
        goToStep(stepIndex + 1);
      });
    },
    [activeSound, celebration, event.id, gardenSnap, goToStep, growNode, stepIndex]
  );

  const handleSlotSkipped = useCallback(() => {
    if (!activeSound) return;
    if (activeSound.isFree) {
      saveDoneSoundStepId(event.id, activeSound.id);
    } else if (activeSound.slotId) {
      saveDoneSlot(event.id, activeSound.slotId);
    }
    setChatError(null);
    goToStep(stepIndex + 1);
  }, [activeSound, event.id, goToStep, stepIndex]);

  const handleVideoSubmitted = useCallback(
    async (blob: Blob) => {
      unlockReferenceTones();
      setChatError(null);
      setSending(true);
      try {
        const convId = await ensureConversation();
        if (!convId) {
          setSending(false);
          throw new Error("Could not start the conversation. Try again.");
        }
        const { storagePath, publicUrl } = await uploadTurnMedia(convId, "video", blob);
        const sent = await sendMessage(convId, "(recording)", {
          videoStoragePath: storagePath,
          videoPublicUrl: publicUrl,
          deviceId: getOrCreateSonggardenDeviceId(),
          journeyManaged,
        });
        setSending(false);
        growNode("video");
        pulseHaptic();
        setBurstMessage(sent.gardenCelebrationLine?.trim() || "Got it");
        if (gardenSnap.linked) void gardenSnap.refresh();
        celebration.celebrate(() => {
          goToStep(stepIndex + 1);
        });
      } catch (err) {
        setSending(false);
        throw err instanceof Error ? err : new Error("Submit failed");
      }
    },
    [celebration, ensureConversation, gardenSnap, goToStep, growNode, journeyManaged, stepIndex]
  );

  function handleParticipateAgain() {
    clearJourneySession(event, interviewVersion, activeSessionToken);
    clearDoneSlots(event.id);
    clearGrowthNodes(event.id);
    setLocalGrowthNodes([]);
    ensuringConversation.current = false;
    setJourneyStarted(false);
    setPosition({ phase: "landing", gardenSlotIndex: 0, stepIndex: 0, interviewVersion });
    setContributionConsentAgreed(false);
    setConversationId(null);
    setActiveSessionToken(null);
    setConversationReady(false);
    setChatError(null);
    setInputValue("");
    setSelectedChannel(null);
    setSending(false);
  }

  // Name is only asked when Joel adds an explicit name step to the journey.
  const finalMessage = event.anthemCompletionMessage?.trim() || DEFAULT_JOURNEY_FINAL_MESSAGE;
  const welcomeEyebrow =
    event.songGardenConfig?.welcomeEyebrow?.trim() || WELCOME_MOMENT_LABEL;
  const completionEyebrow =
    event.songGardenConfig?.completionEyebrow?.trim() || COMPLETION_MOMENT_LABEL;
  const completionButtonText =
    event.songGardenConfig?.completionButtonText?.trim() || DEFAULT_COMPLETION_BUTTON_TEXT;
  const completionButtonOn = isCompletionButtonVisible(event.songGardenConfig);
  const momentKey = `${position.phase}:${stepIndex}:${activeStep?.kind ?? ""}:${promptText}`;

  let eyebrow: string | undefined;
  if (position.phase === "landing") eyebrow = welcomeEyebrow;
  else if (activeStep) eyebrow = resolveCategoryLabel(activeStep);
  else if (position.phase === "final") eyebrow = completionEyebrow;

  return (
    <WorldStage
      world={world}
      energyLevel={energyLevel}
      storyboardFrameIndex={tiedStoryboardFrameIndex}
      celebrationTrigger={celebration.trigger}
      soundtrackUnlocked={worldUnlocked}
      growthNodes={growthNodes}
    >
      <header className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] text-center">
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: world.accentColor, opacity: 0.85 }}
        >
          {world.title}
        </p>
      </header>

      {world.logoUrl ? (
        <WorldBloomLogo url={world.logoUrl} maxWidthPx={world.logoMaxWidthPx} />
      ) : null}

      {world.presenceSimulationEnabled !== false && (
        <WorldPresenceTicker
          eventId={event.id}
          accentColor={world.accentColor}
          className={world.logoUrl ? "mt-2" : "mt-4"}
        />
      )}

      {/* Hide prompt UI instantly while celebrating so the burst isn't overlaid on the question. */}
      {!celebration.active ? (
        <MomentOverlay
          momentKey={momentKey}
          eyebrow={eyebrow}
          accentColor={world.accentColor}
          primaryColor={world.primaryColor}
          progress={
            showProgress ? { completed: progress.completed, total: progress.total } : null
          }
        >
          {position.phase === "landing" && (
            <div className="space-y-6 text-center">
              <div className="space-y-4">
                <p className="mx-auto max-w-md font-mono text-[1.1875rem] font-semibold leading-snug tracking-tight text-white sm:text-[1.25rem]">
                  <TypewriterText
                    key={event.landingHeadline || DEFAULT_OPENING_PROMPT}
                    text={event.landingHeadline || DEFAULT_OPENING_PROMPT}
                    speed={9}
                    className="inline"
                  />
                </p>
                {!!event.landingCopy && (
                  <p className="mx-auto max-w-md font-mono text-[0.9375rem] leading-relaxed text-white/90 sm:text-base">
                    {event.landingCopy}
                  </p>
                )}
              </div>
              <form onSubmit={handleStartJourney} className="space-y-3">
                {requireContributionConsent && (
                  <label className="flex items-start gap-2.5 border-t border-white/10 px-0.5 pt-3 text-left">
                    <input
                      type="checkbox"
                      checked={contributionConsentAgreed}
                      onChange={(e) => setContributionConsentAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ accentColor: world.accentColor }}
                    />
                    <span className="font-mono text-[11px] leading-snug text-white/55">
                      {contributionConsentLabel}
                    </span>
                  </label>
                )}
                <button
                  type="submit"
                  disabled={sending || (requireContributionConsent && !contributionConsentAgreed)}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 px-6 py-3 font-mono text-base font-semibold tracking-wide transition disabled:cursor-not-allowed"
                  style={{
                    borderColor: world.accentColor,
                    color: "#1a1530",
                    background: world.accentColor,
                  }}
                >
                  {sending ? "Starting…" : event.ctaText || DEFAULT_CTA_TEXT}
                </button>
              </form>
              {chatError && <p className="text-center font-mono text-sm text-red-300">{chatError}</p>}
            </div>
          )}

          {position.phase === "step" && showChannelChooser && (
            <div className="space-y-6 text-center">
              {chatError && (
                <p className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                  {chatError}
                </p>
              )}
              <p className="mx-auto max-w-xs font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
                <TypewriterText
                  key={displayPrompt(promptText)}
                  text={displayPrompt(promptText)}
                  speed={9}
                  className="inline"
                />
              </p>
              <div className="mx-auto flex max-w-xs flex-wrap items-center justify-center gap-4">
                {availableChannels.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setSelectedChannel(channel)}
                    className="flex h-24 w-24 [touch-action:manipulation] select-none flex-col items-center justify-center rounded-full font-mono text-xs font-semibold uppercase tracking-wide [-webkit-tap-highlight-color:transparent]"
                    style={{
                      background: `${world.accentColor}1f`,
                      color: world.accentColor,
                      border: `2px solid ${world.accentColor}`,
                      boxShadow: `0 0 0 8px ${world.accentColor}14, 0 0 0 16px ${world.accentColor}0a`,
                    }}
                  >
                    {CHANNEL_LABELS[channel]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {position.phase === "step" && showMomentPad && (
            <div className="space-y-4">
              {chatError && (
                <p className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                  {chatError}
                </p>
              )}
              {sending && !conversationReady ? (
                <div className="flex justify-center py-8">
                  <SpinnerDots accentColor={world.accentColor} />
                </div>
              ) : useTextPad ? (
                <TextMomentPad
                  key={`text-${stepIndex}-${activeStep?.id ?? ""}`}
                  promptText={displayPrompt(promptText)}
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={() => void handleTextSubmit()}
                  placeholder={requiresEmailResponse ? "you@example.com" : "Type your answer…"}
                  disabled={sending}
                  submitDisabled={
                    sending ||
                    captchaSetupRequired ||
                    (captchaGateActive && !emailCaptchaToken) ||
                    !inputValue.trim()
                  }
                  submitLabel={sending ? "Sending…" : "✓ Continue"}
                  accentColor={world.accentColor}
                  hint={responseHint}
                  inputMode={requiresEmailResponse ? "email" : "text"}
                  autoComplete={requiresEmailResponse ? "email" : isNameStep ? "given-name" : "off"}
                  inputRef={(el) => {
                    responseInputRef.current = el;
                  }}
                >
                  {captchaSetupRequired && (
                    <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 font-mono text-xs text-amber-100">
                      Email captcha requires Turnstile keys in .env.local.
                    </p>
                  )}
                  {captchaGateActive && (
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-mono text-sm text-gray-300">Quick verification — then continue.</p>
                      <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setEmailCaptchaToken} />
                    </div>
                  )}
                </TextMomentPad>
              ) : (
                <VideoMomentPad
                  key={`video-${stepIndex}-${activeStep?.id ?? ""}`}
                  promptText={displayPrompt(promptText)}
                  buttonLabel="Record"
                  accentColor={world.accentColor}
                  recordMs={
                    activeStep?.kind === "prompt"
                      ? resolvePromptRecordMs(activeStep, "video")
                      : undefined
                  }
                  disabled={sending}
                  onSubmitted={handleVideoSubmitted}
                />
              )}
              {availableChannels.length > 1 && selectedChannel && (
                <button
                  type="button"
                  onClick={() => setSelectedChannel(null)}
                  className="mx-auto block font-mono text-xs text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-gray-200"
                >
                  ← Choose again
                </button>
              )}
            </div>
          )}

          {position.phase === "step" && useAudioPad && activeSound && (
            <div className="space-y-4">
              <SoundMomentPad
                key={activeSound.isFree ? `free-${activeSound.id}` : activeSound.slot.id}
                eventId={event.id}
                slot={activeSound.slot}
                promptText={activeSound.prompt}
                buttonLabel={activeSound.buttonLabel}
                contributorName={contributorName.trim() || null}
                accentColor={world.accentColor}
                recordMs={activeSound.recordMs}
                progressSlotId={activeSound.isFree ? null : activeSound.slotId}
                alternateSlots={activeSound.alternateSlots}
                onSubmitted={handleSlotSubmitted}
                onSkip={handleSlotSkipped}
              />
              {availableChannels.length > 1 && selectedChannel && (
                <button
                  type="button"
                  onClick={() => setSelectedChannel(null)}
                  className="mx-auto block font-mono text-xs text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-gray-200"
                >
                  ← Choose again
                </button>
              )}
            </div>
          )}

          {position.phase === "final" && (
            <div className="space-y-6 text-center">
              <p className="mx-auto max-w-md font-mono text-base leading-snug text-gray-100 sm:text-lg">
                <TypewriterText key={finalMessage} text={finalMessage} speed={9} className="inline" />
              </p>
              {completionButtonOn && (
                <button
                  type="button"
                  onClick={handleParticipateAgain}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border px-6 py-3 font-mono text-base font-semibold tracking-wide"
                  style={{ borderColor: world.accentColor, color: world.accentColor }}
                >
                  {completionButtonText}
                </button>
              )}
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
