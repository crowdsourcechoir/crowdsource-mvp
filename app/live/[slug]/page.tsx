"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getSessionBySlug,
  submitResponse,
  listRounds,
  getPhraseCards,
  castVote,
  getMyVotes,
  joinUrl,
  type PromptGameSession,
  type PromptGameRound,
  type PhraseCard,
} from "@/data/livePromptGame";
import { parsePromptBlock, type SignalPromptBlock } from "@/data/signalPromptBlock";
import QRCodeDisplay from "@/components/QRCodeDisplay";

const POLL_MS = 2500;
const DEVICE_ID_KEY = "csc_live_device_id";
const SUBMITTED_KEY_PREFIX = "csc_live_submitted_";

function submittedKey(sessionId: string, roundId: string): string {
  return `${SUBMITTED_KEY_PREFIX}${sessionId}_${roundId}`;
}

function hasSubmittedForRound(sessionId: string, roundId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(submittedKey(sessionId, roundId)) === "1";
}

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export default function LiveJoinPage({ params }: { params: { slug: string } }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [session, setSession] = useState<PromptGameSession | null>(null);
  const [currentRound, setCurrentRound] = useState<PromptGameRound | null>(null);
  const [phraseCards, setPhraseCards] = useState<PhraseCard[]>([]);
  const [myVoteIds, setMyVoteIds] = useState<string[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedForRoundId, setSubmittedForRoundId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  // Resolve slug from params (sync in Next.js 14)
  const resolvedSlug = typeof params?.slug === "string" ? params.slug : null;
  useEffect(() => {
    setSlug(resolvedSlug);
    if (typeof window !== "undefined") setDeviceId(getOrCreateDeviceId());
  }, [resolvedSlug]);

  const refresh = useCallback(async (s: PromptGameSession) => {
    const updated = await getSessionBySlug(s.slug);
    if (!updated) return;
    setSession(updated);
    if (updated.current_round_id) {
      const [roundsList, cardsRes] = await Promise.all([
        listRounds(updated.id),
        getPhraseCards(updated.id, updated.current_round_id),
      ]);
      const current = roundsList.find((r) => r.id === updated.current_round_id) ?? null;
      setCurrentRound(current);
      setPhraseCards(Array.isArray(cardsRes) ? cardsRes : []);
      if (updated.state === "VOTING" && deviceId) {
        const votes = await getMyVotes(updated.id, updated.current_round_id, deviceId);
        setMyVoteIds(Array.isArray(votes) ? votes : []);
      }
    } else {
      setCurrentRound(null);
      setPhraseCards([]);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!slug || !deviceId) return;
    setLoadError(null);
    getSessionBySlug(slug)
      .then((s) => {
        if (s) {
          setSession(s);
          setLoadError(null);
          return refresh(s);
        }
        setLoadError("Session not found.");
      })
      .catch(() => {
        setSession(null);
        setLoadError("Could not load session. Check the link or try again.");
      });
  }, [slug, deviceId, refresh]);

  useEffect(() => {
    if (!session || !deviceId) return;
    const interval = setInterval(() => {
      refresh(session).catch(() => { /* ignore poll errors */ });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [session, deviceId, refresh]);

  // Timer countdown for current round (when host set timer_seconds)
  useEffect(() => {
    if (!currentRound?.timer_seconds || session?.state !== "RESPONDING") {
      setTimerRemaining(null);
      return;
    }
    setTimerRemaining(currentRound.timer_seconds);
    const interval = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentRound?.id, currentRound?.timer_seconds, session?.state]);

  const handleSubmit = async () => {
    if (!session?.current_round_id || !responseText.trim() || !deviceId) return;
    setSubmitting(true);
    try {
      await submitResponse(session.id, session.current_round_id, deviceId, responseText.trim());
      setResponseText("");
      setSubmitted(true);
      setSubmittedForRoundId(session.current_round_id);
      if (typeof window !== "undefined") {
        localStorage.setItem(submittedKey(session.id, session.current_round_id), "1");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (submissionId: string) => {
    if (!session?.current_round_id || !deviceId) return;
    if (myVoteIds.length >= 3 && !myVoteIds.includes(submissionId)) return;
    try {
      await castVote(session.id, session.current_round_id, submissionId, deviceId);
      if (myVoteIds.includes(submissionId)) {
        setMyVoteIds((prev) => prev.filter((id) => id !== submissionId));
      } else {
        setMyVoteIds((prev) => [...prev, submissionId].slice(-3));
      }
      await refresh(session);
    } catch (e) {
      console.error(e);
    }
  };

  const maxChars = currentRound?.character_limit ?? 140;

  const signalBlock: SignalPromptBlock | null = useMemo(() => {
    const b = currentRound ? parsePromptBlock(currentRound.prompt_block) : null;
    if (!b || b.kind !== "signal") return null;
    const ready = b.choices.every((c) => typeof c.submissionId === "string" && c.submissionId.length > 0);
    return ready ? b : null;
  }, [currentRound]);

  const layerLabel = (layer: string) =>
    layer === "harmonic"
      ? "Harmonic world"
      : layer === "rhythmic"
        ? "Rhythm world"
        : layer === "energy"
          ? "Energy"
          : layer === "fx"
            ? "FX world"
            : layer === "bass"
              ? "Bass"
              : layer === "vocal"
                ? "Vocal layer"
                : layer;

  const voteCountBySubmissionId = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of phraseCards) m.set(c.id, c.vote_count);
    return m;
  }, [phraseCards]);

  const handleSignalVote = async (submissionId: string) => {
    if (!session?.current_round_id || !deviceId) return;
    if (myVoteIds.includes(submissionId)) return;
    try {
      await castVote(session.id, session.current_round_id, submissionId, deviceId);
      setMyVoteIds([submissionId]);
      await refresh(session);
    } catch (e) {
      console.error(e);
    }
  };

  if (!session && !loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0c0e] text-white">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0c0c0e] px-4 text-center text-white">
        <p className="text-lg">Session not found</p>
        <p className="text-sm text-gray-500">
          {loadError || "Check the link or scan the QR again."}
        </p>
        <a
          href="/"
          className="mt-4 text-sm font-medium text-gray-400 hover:text-white"
        >
          Go home
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Header: logo upper left, QR upper right */}
        <div className="flex items-start justify-between gap-4">
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Crowdsource Choir"
              className="h-12 w-auto sm:h-14"
            />
          </div>
          {typeof window !== "undefined" && session && (
            <div className="shrink-0">
              <QRCodeDisplay
                url={joinUrl(session.slug)}
                size={96}
                highRes
                className="shrink-0"
              />
            </div>
          )}
        </div>

        <div className="mt-6">
        {session.state === "WAITING" ? (
          <p className="mt-8 text-center text-lg text-gray-300">
            You&apos;re in! Waiting for host to start.
          </p>
        ) : (
          <>
            {session.state === "VOTING" && !signalBlock && (
              <h1 className="mt-6 text-xl font-bold text-white sm:text-2xl">
                Vote for your favorite phrases (up to 3).
              </h1>
            )}
            {session.state === "VOTING" && signalBlock && (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-500/90">Signal</p>
                <h1 className="text-xl font-bold text-white sm:text-2xl">Shape the next sound together</h1>
                <p className="text-sm text-gray-400">
                  One collective choice per round. Tap the world that fits the room.
                </p>
              </div>
            )}

        {session.state === "RESPONDING" && currentRound && (
          <div className="mt-6 rounded-2xl border border-gray-700/60 bg-[#18181b] p-4 sm:p-6">
            <p className="text-lg text-white">{currentRound.prompt_text}</p>
            {currentRound.timer_seconds != null && currentRound.timer_seconds > 0 && (
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                {timerRemaining !== null && timerRemaining <= 0
                  ? "Time's up"
                  : (() => {
                      const s = timerRemaining ?? currentRound.timer_seconds ?? 0;
                      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
                    })()}
              </p>
            )}
            {hasSubmittedForRound(session.id, currentRound.id) || submittedForRoundId === currentRound.id ? (
              <p className="mt-4 text-center text-gray-400">
                Thanks, you&apos;ve submitted. Waiting for the next prompt.
              </p>
            ) : (
              <>
                <div className="mt-4">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value.slice(0, maxChars))}
                    placeholder="Your response…"
                    rows={3}
                    maxLength={maxChars}
                    className="w-full resize-y rounded-xl border border-gray-600 bg-[#1f1f1f] px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                  />
                  <p className="mt-1 text-right text-xs text-gray-500">
                    {responseText.length} / {maxChars}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting || !responseText.trim()}
                  onClick={handleSubmit}
                  className="mt-4 w-full min-h-[48px] rounded-xl bg-white py-3 text-base font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {submitting ? "Sending…" : submitted ? "Submitted ✓" : "Submit"}
                </button>
              </>
            )}
          </div>
        )}

        {session.state === "VOTING" && signalBlock && currentRound && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-400/90">
                {layerLabel(signalBlock.layerType)}
              </p>
              <p className="mt-2 text-lg font-medium leading-snug text-white">{currentRound.prompt_text}</p>
            </div>
            <p className="text-center text-sm text-gray-400">
              {myVoteIds.length === 0 ? "Tap your choice — you can change it until the host closes the round." : "You’re in. Tap another option to switch your vote."}
            </p>
            <div className="grid gap-3">
              {signalBlock.choices.map((ch) => {
                const sid = ch.submissionId!;
                const voted = myVoteIds.includes(sid);
                const votes = voteCountBySubmissionId.get(sid) ?? 0;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSignalVote(sid)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      voted
                        ? "border-amber-400 bg-amber-950/50 text-white shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                        : "border-gray-700/60 bg-[#18181b] text-gray-100 hover:border-amber-900/50 hover:bg-[#1f1f23]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-lg font-semibold">{ch.label}</span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-500">{votes} votes</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {session.state === "VOTING" && !signalBlock && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-gray-500">
              You have {3 - myVoteIds.length} vote(s) left. Tap a phrase to vote.
            </p>
            {phraseCards.map((c) => {
              const voted = myVoteIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleVote(c.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    voted
                      ? "border-amber-500 bg-amber-950/40 text-white"
                      : "border-gray-700/60 bg-[#18181b] text-gray-200 hover:border-gray-600"
                  }`}
                >
                  <p className="font-medium">{c.raw_text}</p>
                  <p className="mt-1 text-xs text-gray-500">Votes: {c.vote_count}</p>
                </button>
              );
            })}
            {phraseCards.length === 0 && (
              <p className="rounded-xl border border-gray-700/60 bg-[#18181b] p-6 text-center text-gray-500">
                No phrase cards yet.
              </p>
            )}
          </div>
        )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
