"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import {
  getSession,
  updateSessionState,
  endSession,
  createRound,
  closeRound,
  listRounds,
  listSubmissions,
  getPhraseCards,
  setSubmissionHidden,
  setSubmissionLocked,
  joinUrl,
  displayUrl,
  exportRawCsvUrl,
  generateSongPack,
  getSongPack,
  type PromptGameSession,
  type PromptGameRound,
  type PromptGameSubmission,
  type PhraseCard,
  type ResponseType,
} from "@/data/livePromptGame";
import { DEFAULT_SIGNAL_HARMONIC_BLOCK, parsePromptBlock } from "@/data/signalPromptBlock";

const POLL_MS = 2500;
const VOTING_SECONDS_PER_ROUND = 10;

type PrepopCategoryId = "genre" | "mood" | "tempo" | "energy" | "style" | "theme";

type PrepopQuestion = {
  categoryId: PrepopCategoryId;
  promptText: string;
  responseType: ResponseType;
  characterLimit: number;
  timerSeconds: number | null;
};

const PREPOP_CATEGORY_ORDER: PrepopCategoryId[] = ["genre", "mood", "tempo", "energy", "style", "theme"];

const PREPOP_CATEGORY_LABELS: Record<PrepopCategoryId, string> = {
  genre: "Genre",
  mood: "Mood",
  tempo: "Tempo",
  energy: "Energy",
  style: "Style",
  theme: "Theme",
};

export default function HostControlRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<PromptGameSession | null>(null);
  const [rounds, setRounds] = useState<PromptGameRound[]>([]);
  const [submissions, setSubmissions] = useState<PromptGameSubmission[]>([]);
  const [phraseCards, setPhraseCards] = useState<PhraseCard[]>([]);
  const [promptText, setPromptText] = useState("");
  const [responseType, setResponseType] = useState<ResponseType>("short_phrase");
  const [characterLimit, setCharacterLimit] = useState(140);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(20);
  const [sending, setSending] = useState(false);
  const [gameMode, setGameMode] = useState<"live" | "prepop">("live");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [songPackLoading, setSongPackLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [votingCountdown, setVotingCountdown] = useState<number | null>(null);
  const votingRoundIdRef = useRef<string | null>(null);
  const advancingVotingRef = useRef(false);

  // Pre-populated mode state (admin selects categories; host generates a question queue).
  const [prepopSelectedCategories, setPrepopSelectedCategories] = useState<PrepopCategoryId[]>([...PREPOP_CATEGORY_ORDER]);
  const [prepopQueue, setPrepopQueue] = useState<PrepopQuestion[]>([]);
  const [prepopActiveIndex, setPrepopActiveIndex] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  const resolveParams = useCallback(async () => {
    const { id } = await params;
    setSessionId(id);
    return id;
  }, [params]);

  const refresh = useCallback(async (id: string) => {
    const [s, r] = await Promise.all([
      getSession(id),
      listRounds(id),
    ]);
    setSession(s ?? null);
    setRounds(Array.isArray(r) ? r : []);
    if (s?.current_round_id) {
      const [subs, cards] = await Promise.all([
        listSubmissions(id, s.current_round_id),
        s.state === "VOTING" ? getPhraseCards(id, s.current_round_id) : Promise.resolve([]),
      ]);
      setSubmissions(Array.isArray(subs) ? subs : []);
      setPhraseCards(Array.isArray(cards) ? cards : []);
    } else {
      setSubmissions([]);
      setPhraseCards([]);
    }
  }, []);

  useEffect(() => {
    let id: string | null = null;
    resolveParams().then((resolved) => {
      id = resolved;
      refresh(resolved);
    });
    const interval = setInterval(() => {
      if (id) refresh(id);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [resolveParams, refresh]);

  const handleSendPrompt = async () => {
    if (!sessionId || !promptText.trim()) return;
    setSending(true);
    try {
      const round = await createRound(sessionId, {
        prompt_text: promptText.trim(),
        response_type: responseType,
        character_limit: characterLimit,
        timer_seconds: timerSeconds ?? undefined,
      });
      setPromptText("");
      setRounds((prev) => [...prev, round]);
      setSession((prev) =>
        prev
          ? { ...prev, state: "RESPONDING", current_round_id: round.id }
          : null
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleSignalHarmonicRound = async () => {
    if (!sessionId) return;
    setSending(true);
    try {
      const round = await createRound(sessionId, {
        prompt_text: "Where should the harmonic world drift next?",
        response_type: "short_phrase",
        character_limit: 80,
        timer_seconds: null,
        prompt_block: DEFAULT_SIGNAL_HARMONIC_BLOCK,
      });
      setRounds((prev) => [...prev, round]);
      setSession((prev) =>
        prev ? { ...prev, state: "VOTING", current_round_id: round.id } : null
      );
      await refresh(sessionId);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  function buildPrepopPrompt(categoryId: PrepopCategoryId): string {
    // Phrased to encourage audiences to submit short phrases that later become "multiple-choice" phrase cards.
    switch (categoryId) {
      case "genre":
        return "Genre: What genre should the song be? Reply with 1-2 words.";
      case "mood":
        return "Mood: What vibe should the song have? Reply with 1-2 words.";
      case "tempo":
        return "Tempo: Slow, mid, or fast? Reply with one word: slow / mid / fast.";
      case "energy":
        return "Energy: How high-energy should it be? Reply with 1-2 words.";
      case "style":
        return "Style: What musical style should it feel like? Reply with 1-2 words.";
      case "theme":
        return "Theme: What theme/story should the song be about? Reply with a short phrase (3-6 words).";
    }
  }

  function buildPrepopQueue(categories: PrepopCategoryId[]): PrepopQuestion[] {
    // Defaults tuned for fast audience interaction.
    const defaultResponseType: ResponseType = "short_phrase";
    const defaultCharacterLimit = 80;
    const defaultTimerSeconds = 20;

    return categories.map((categoryId) => ({
      categoryId,
      promptText: buildPrepopPrompt(categoryId),
      responseType: defaultResponseType,
      characterLimit: defaultCharacterLimit,
      timerSeconds: defaultTimerSeconds,
    }));
  }

  const handlePrepopStart = async () => {
    if (!sessionId) return;
    if (prepopSelectedCategories.length === 0) return;

    const queue = buildPrepopQueue(prepopSelectedCategories);
    setPrepopQueue(queue);
    setPrepopActiveIndex(0);

    const first = queue[0];
    if (!first) return;
    setSending(true);
    try {
      const round = await createRound(sessionId, {
        prompt_text: first.promptText,
        response_type: first.responseType,
        character_limit: first.characterLimit,
        timer_seconds: first.timerSeconds ?? undefined,
      });
      setSession((prev) =>
        prev
          ? {
              ...prev,
              state: "RESPONDING",
              current_round_id: round.id,
            }
          : null
      );
      setRounds((prev) => [...prev, round]);
      await refresh(sessionId);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handlePrepopNextQuestion = async () => {
    if (!sessionId) return;
    const nextIndex = prepopActiveIndex + 1;
    if (nextIndex >= prepopQueue.length) {
      // No more questions: move back to waiting.
      await updateSessionState(sessionId, "WAITING", null);
      await refresh(sessionId);
      return;
    }

    const next = prepopQueue[nextIndex];
    if (!next) return;

    setActionLoading("prepop-next");
    try {
      const round = await createRound(sessionId, {
        prompt_text: next.promptText,
        response_type: next.responseType,
        character_limit: next.characterLimit,
        timer_seconds: next.timerSeconds ?? undefined,
      });
      setPrepopActiveIndex(nextIndex);

      await updateSessionState(sessionId, "RESPONDING", round.id);
      await refresh(sessionId);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const togglePrepopCategory = (categoryId: PrepopCategoryId) => {
    setPrepopSelectedCategories((prev) => {
      const set = new Set(prev);
      if (set.has(categoryId)) set.delete(categoryId);
      else set.add(categoryId);
      // Keep a stable order so "Start game" feels predictable.
      return PREPOP_CATEGORY_ORDER.filter((c) => set.has(c));
    });
  };

  const handleCloseSubmissions = async () => {
    if (!sessionId || !session?.current_round_id) return;
    setActionLoading("close");
    try {
      await closeRound(sessionId, session.current_round_id);
      await refresh(sessionId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevealResults = async () => {
    if (!sessionId || !session?.current_round_id) return;
    const roundId = session.current_round_id;
    setActionLoading("reveal");
    try {
      await closeRound(sessionId, roundId);
      await updateSessionState(sessionId, "VOTING", roundId);
      await refresh(sessionId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartVoting = async () => {
    if (!sessionId || !session?.current_round_id) return;
    setActionLoading("voting");
    try {
      await updateSessionState(sessionId, "VOTING", session.current_round_id);
      await refresh(sessionId);
    } finally {
      setActionLoading(null);
    }
  };

  const advanceToNextVotingRound = useCallback(async () => {
    if (!sessionId || !session?.current_round_id || rounds.length === 0) return;
    setVotingCountdown(null);
    advancingVotingRef.current = true;
    try {
      const idx = rounds.findIndex((r) => r.id === session.current_round_id);
      if (idx < 0) return;
      if (idx < rounds.length - 1) {
        await updateSessionState(sessionId, "VOTING", rounds[idx + 1].id);
      } else {
        await updateSessionState(sessionId, "WAITING", null);
        votingRoundIdRef.current = null;
      }
      await refresh(sessionId);
    } finally {
      advancingVotingRef.current = false;
    }
  }, [sessionId, session?.current_round_id, rounds, refresh]);

  useEffect(() => {
    if (session?.state !== "VOTING" || !session.current_round_id || !sessionId || rounds.length === 0) {
      if (session?.state !== "VOTING") {
        votingRoundIdRef.current = null;
        setVotingCountdown(null);
      }
      return;
    }
    const currentRoundForTimer = rounds.find((r) => r.id === session.current_round_id);
    const isSignalRound = parsePromptBlock(currentRoundForTimer?.prompt_block)?.kind === "signal";
    if (isSignalRound) {
      setVotingCountdown(null);
      return;
    }
    if (votingRoundIdRef.current !== session.current_round_id) {
      votingRoundIdRef.current = session.current_round_id;
      setVotingCountdown(VOTING_SECONDS_PER_ROUND);
    }
    const interval = setInterval(() => {
      setVotingCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.state, session?.current_round_id, sessionId, rounds]);

  useEffect(() => {
    if (
      gameMode === "prepop" ||
      session?.state !== "VOTING" ||
      votingCountdown !== 0 ||
      !sessionId ||
      advancingVotingRef.current
    )
      return;
    advanceToNextVotingRound();
  }, [gameMode, session?.state, votingCountdown, sessionId, advanceToNextVotingRound]);

  const handleCloseVoting = async () => {
    if (!sessionId) return;
    setActionLoading("close-vote");
    try {
      await updateSessionState(sessionId, "WAITING", null);
      await refresh(sessionId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    setActionLoading("end");
    try {
      await endSession(sessionId);
      setSession((prev) => (prev ? { ...prev, ended_at: new Date().toISOString() } : null));
    } finally {
      setActionLoading(null);
    }
  };

  const handleHideCard = async (submissionId: string, hidden: boolean) => {
    if (!sessionId) return;
    try {
      await setSubmissionHidden(sessionId, submissionId, hidden);
      if (session?.current_round_id) await refresh(sessionId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLockCard = async (submissionId: string, locked: boolean) => {
    if (!sessionId) return;
    try {
      await setSubmissionLocked(sessionId, submissionId, locked);
      if (session?.current_round_id) await refresh(sessionId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportRaw = () => {
    if (!sessionId) return;
    window.open(exportRawCsvUrl(sessionId), "_blank");
  };

  const handleGenerateSongPack = async () => {
    if (!sessionId) return;
    setSongPackLoading(true);
    try {
      await generateSongPack(sessionId);
      await refresh(sessionId);
    } catch (e) {
      console.error(e);
    } finally {
      setSongPackLoading(false);
    }
  };

  const handleDownloadSongPack = async () => {
    if (!sessionId) return;
    const pack = await getSongPack(sessionId);
    if (!pack || typeof pack !== "object") return;
    const text = JSON.stringify(pack, null, 2);
    const blob = new Blob([text], { type: "application/json; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `song-pack-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!sessionId || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0c0e] text-gray-500">
        Loading…
      </div>
    );
  }

  const joinLink = joinUrl(session.slug, baseUrl);
  const currentRound = rounds.find((r) => r.id === session.current_round_id);
  const signalBlockHost = currentRound ? parsePromptBlock(currentRound.prompt_block) : null;
  const signalLeadingCard =
    signalBlockHost?.kind === "signal" && session.state === "VOTING" && phraseCards.length > 0
      ? phraseCards.reduce((a, b) => (a.vote_count >= b.vote_count ? a : b), phraseCards[0])
      : null;
  const signalLeadingChoice =
    signalLeadingCard && signalBlockHost?.kind === "signal"
      ? signalBlockHost.choices.find((c) => c.submissionId === signalLeadingCard.id)
      : null;

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Host Control Room</h1>
          <p className="mt-1 text-sm text-gray-400">
            {session.name} · {session.state}
            {session.ended_at ? " · Ended" : ""}
          </p>
        </div>
        <Link
          href="/admin/live"
          className="text-sm font-medium text-gray-500 hover:text-gray-300"
        >
          ← Live
        </Link>
      </div>

      {/* Stage state */}
      <section className="mb-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Stage
        </h2>
        <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
          {session.state === "WAITING" && "WAITING — Join Now"}
          {session.state === "RESPONDING" && "RESPONDING — Submissions Open"}
          {session.state === "VOTING" &&
            (signalBlockHost?.kind === "signal" ? "VOTING — Collective choice" : "VOTING — Vote on Phrases")}
        </p>

        {session.state === "VOTING" && signalLeadingChoice && (
          <div className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-50">
            <p className="font-semibold text-amber-200">Room pulse (live)</p>
            <p className="mt-1 text-white">
              Leading: <span className="font-medium">{signalLeadingChoice.label}</span> ({signalLeadingCard?.vote_count ?? 0}{" "}
              votes)
            </p>
            <p className="mt-1 font-mono text-xs text-amber-100/80">Stub trigger: {signalLeadingChoice.triggerId}</p>
          </div>
        )}

        {!session.ended_at && (
          <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <QRCodeDisplay
              url={joinLink}
              size={160}
              className="shrink-0"
            />
            <div>
              <a
                href={displayUrl(session.slug, baseUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 inline-block rounded bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-gray-200"
              >
                Display on screen →
              </a>
              <p className="text-sm font-medium text-gray-400">Join URL</p>
              <p className="mt-1 break-all font-mono text-white">{joinLink}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(joinLink)}
                className="mt-2 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
              >
                Copy link
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Prompt composer — always available while session is active so host can send a new prompt anytime */}
      {!session.ended_at && (
        <section className="mb-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{session.name} setup</h2>
              <p className="mt-1 text-xs text-gray-500">
                {session.name === "Game" || session.name === "Live Prompt Game"
                  ? "Live Prompt Mode is custom prompts. Pre-Populated Mode generates a fast category queue."
                  : session.name === "Signal"
                    ? "Signal: collective emotional choices map to stub Ableton trigger IDs (OSC/MIDI later). Use Harmonic round to prototype one voting screen."
                    : "This session is using the same Game-flow host controls for now. Fishbowl setup will be customized next."}
              </p>
            </div>

            <div className="flex rounded-xl border border-gray-700/60 bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setGameMode("live")}
                className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold transition ${
                  gameMode === "live" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Live Prompt
              </button>
              <button
                type="button"
                onClick={() => setGameMode("prepop")}
                className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold transition ${
                  gameMode === "prepop" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Pre-populated
              </button>
            </div>
          </div>

          {gameMode === "live" ? (
            <>
              {session.name === "Signal" && (
                <div className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/25 p-4">
                  <h3 className="text-sm font-semibold text-amber-200">Signal prototype</h3>
                  <p className="mt-1 text-xs text-gray-400">
                    One voting round: harmonic worlds (Ocean / Fire / Night / Sunrise). Opens immediately in VOTING.
                    Stub trigger IDs are logged for future Ableton; audience only sees emotional labels.
                  </p>
                  <button
                    type="button"
                    disabled={sending || session.state !== "WAITING"}
                    onClick={handleSignalHarmonicRound}
                    className="mt-3 min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-500 disabled:opacity-40"
                  >
                    {sending ? "Starting…" : "Start harmonic world vote"}
                  </button>
                  {session.state !== "WAITING" && (
                    <p className="mt-2 text-xs text-gray-500">
                      End the current stage (close voting → waiting) before launching another prototype round.
                    </p>
                  )}
                </div>
              )}
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Type your prompt…"
                rows={3}
                className="mt-3 w-full resize-y rounded-lg border border-gray-600 bg-[#1f1f1f] px-3 py-2 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Response type:</span>
                  <select
                    value={responseType}
                    onChange={(e) => setResponseType(e.target.value as ResponseType)}
                    className="rounded border border-gray-600 bg-[#1f1f1f] px-2 py-1 text-white"
                  >
                    <option value="one_word">One word</option>
                    <option value="short_phrase">Short phrase</option>
                    <option value="sentence">Sentence</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Char limit:</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={characterLimit}
                    onChange={(e) => setCharacterLimit(Number(e.target.value) || 140)}
                    className="w-20 rounded border border-gray-600 bg-[#1f1f1f] px-2 py-1 text-white"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Timer (s):</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Off"
                    value={timerSeconds ?? ""}
                    onChange={(e) => setTimerSeconds(e.target.value === "" ? null : Number(e.target.value))}
                    className="w-20 rounded border border-gray-600 bg-[#1f1f1f] px-2 py-1 text-white"
                  />
                </label>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  disabled={sending || !promptText.trim()}
                  onClick={handleSendPrompt}
                  className="min-h-[48px] rounded-xl bg-white px-6 py-3 text-base font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send Prompt Live"}
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                <span className="font-medium text-gray-300">Question categories:</span>
                <span className="text-xs">(tap to include/exclude)</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PREPOP_CATEGORY_ORDER.map((cat) => {
                  const selected = prepopSelectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => togglePrepopCategory(cat)}
                      className={`min-h-[40px] rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        selected ? "bg-gray-800 text-white" : "border border-gray-700 bg-[#1f1f1f] text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {PREPOP_CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={sending || prepopSelectedCategories.length === 0}
                  onClick={handlePrepopStart}
                  className="min-h-[48px] w-full rounded-xl bg-white px-6 py-3 text-base font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {sending ? "Starting…" : "Start Pre-populated Game"}
                </button>
              </div>

              {prepopQueue.length > 0 && (
                <div className="mt-3 rounded-xl border border-gray-700/60 bg-[#1f1f1f] px-4 py-3 text-sm text-gray-300">
                  <div className="font-semibold text-white">
                    Queue: {prepopQueue.length} questions
                  </div>
                  <div className="mt-1">
                    Active: {prepopActiveIndex + 1} / {prepopQueue.length} (
                    {PREPOP_CATEGORY_LABELS[prepopQueue[prepopActiveIndex]?.categoryId ?? "genre"]})
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Host controls */}
      {!session.ended_at && (
        <section className="mb-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Controls
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {session.state === "RESPONDING" && (
              <>
                {gameMode === "prepop" ? (
                  <button
                    type="button"
                    disabled={!session.current_round_id || actionLoading !== null}
                    onClick={handleRevealResults}
                    className="min-h-[44px] rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    {actionLoading === "reveal" ? "…" : "Reveal Results"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!session.current_round_id || actionLoading !== null}
                      onClick={handleCloseSubmissions}
                      className="min-h-[44px] rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {actionLoading === "close" ? "…" : "Close Submissions"}
                    </button>
                    <button
                      type="button"
                      disabled={rounds.length === 0 || actionLoading !== null}
                      onClick={handleStartVoting}
                      className="min-h-[44px] rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                    >
                      {actionLoading === "voting" ? "…" : "Start Voting"}
                    </button>
                  </>
                )}
              </>
            )}
            {session.state === "VOTING" && (
              <>
                {gameMode === "prepop" ? (
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handlePrepopNextQuestion}
                    className="min-h-[44px] rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    {actionLoading === "prepop-next" ? "…" : "Next Question"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={handleCloseVoting}
                      className="min-h-[44px] rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {actionLoading === "close-vote" ? "…" : "Close Voting"}
                    </button>
                    <span className="flex items-center text-sm text-gray-500">Or send a new prompt above to start another round.</span>
                  </>
                )}
              </>
            )}
            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={handleEndSession}
              className="min-h-[44px] rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900/40 disabled:opacity-50"
            >
              {actionLoading === "end" ? "…" : "End Session"}
            </button>
          </div>
        </section>
      )}

      {/* Current round prompt (when RESPONDING or VOTING) */}
      {currentRound && (session.state === "RESPONDING" || session.state === "VOTING") && (
        <section className="mb-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {session.state === "VOTING"
                ? `Question ${rounds.findIndex((r) => r.id === session.current_round_id) + 1} of ${rounds.length}`
                : "Current prompt"}
            </h2>
            {session.state === "VOTING" && gameMode !== "prepop" && (
              <div className="flex items-center gap-3">
                {votingCountdown !== null && (
                  <span className="text-sm font-medium text-amber-400">
                    Next question in {votingCountdown}s
                  </span>
                )}
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={advanceToNextVotingRound}
                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
            {session.state === "VOTING" && gameMode === "prepop" && (
              <span className="text-sm text-gray-500">Use “Next Question” in Controls.</span>
            )}
          </div>
          <p className="mt-2 text-lg text-white">{currentRound.prompt_text}</p>
        </section>
      )}

      {/* Raw submissions (RESPONDING) */}
      {session.state === "RESPONDING" && submissions.length > 0 && (
        <section className="mb-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Raw submissions ({submissions.length})
          </h2>
          <ul className="mt-3 max-h-64 overflow-y-auto space-y-1.5 text-sm">
            {submissions.map((s) => (
              <li key={s.id} className="rounded border border-gray-700/60 bg-[#1f1f1f] px-3 py-2 text-gray-200">
                {s.raw_text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phrase cards (VOTING) */}
      {session.state === "VOTING" && (
        <section className="mb-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Phrase cards (tap to hide/lock)
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {phraseCards.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-3 ${
                  c.locked
                    ? "border-amber-600/60 bg-amber-950/30"
                    : "border-gray-700/60 bg-[#1f1f1f]"
                }`}
              >
                <p className="text-white">{c.raw_text}</p>
                <p className="mt-1 text-xs text-gray-500">Votes: {c.vote_count}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleHideCard(c.id, true)}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLockCard(c.id, !c.locked)}
                    className="text-xs text-gray-500 hover:text-amber-400"
                  >
                    {c.locked ? "Unlock" : "Lock top"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {phraseCards.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">No phrase cards yet. Close submissions and start voting to generate.</p>
          )}
        </section>
      )}

      {/* Exports */}
      <section className="mb-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Export
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={sessionId ? exportRawCsvUrl(sessionId) : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Export raw (CSV)
          </a>
          <button
            type="button"
            disabled={songPackLoading}
            onClick={handleGenerateSongPack}
            className="min-h-[44px] rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {songPackLoading ? "Generating…" : "Generate Song Pack (AI)"}
          </button>
          <button
            type="button"
            onClick={handleDownloadSongPack}
            className="min-h-[44px] rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Download Song Pack
          </button>
        </div>
      </section>
    </div>
  );
}
