"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSessionBySlug,
  listRounds,
  listSubmissions,
  joinUrl,
  sessionDisplayMode,
  type PromptGameSession,
  type PromptGameRound,
  type PromptGameSubmission,
} from "@/data/livePromptGame";
import { parsePromptBlock, isMediaPromptBlock } from "@/data/signalPromptBlock";
import { isDisplayableSubmission } from "@/lib/live-prompt-game/rows";
import QRCodeDisplay from "@/components/QRCodeDisplay";

const QR_SIZE = 480;
const POLL_MS = 1200;

export default function LiveDisplayPage({ params }: { params: { slug: string } }) {
  const slug = typeof params?.slug === "string" ? params.slug : null;
  const [joinLink, setJoinLink] = useState("");
  const [session, setSession] = useState<PromptGameSession | null>(null);
  const [round, setRound] = useState<PromptGameRound | null>(null);
  const [submissions, setSubmissions] = useState<PromptGameSubmission[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && slug) {
      setJoinLink(joinUrl(slug));
    }
  }, [slug]);

  const refresh = useCallback(async () => {
    if (!slug) return;
    const s = await getSessionBySlug(slug);
    if (!s) {
      setSession(null);
      setRound(null);
      setSubmissions([]);
      return;
    }
    setSession(s);
    if (!s.current_round_id) {
      setRound(null);
      setSubmissions([]);
      return;
    }
    const [rounds, subs] = await Promise.all([
      listRounds(s.id),
      listSubmissions(s.id, s.current_round_id),
    ]);
    setRound(rounds.find((r) => r.id === s.current_round_id) ?? null);
    setSubmissions(Array.isArray(subs) ? subs : []);
  }, [slug]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      void refresh().catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const mediaBlock = useMemo(() => {
    const b = round ? parsePromptBlock(round.prompt_block) : null;
    return isMediaPromptBlock(b) ? b : null;
  }, [round]);

  const mode = sessionDisplayMode(session);
  const wall = useMemo(
    () => submissions.filter((s) => isDisplayableSubmission(s, mode)),
    [submissions, mode]
  );
  const photos = wall.filter((s) => s.media_type === "photo" && s.media_url);
  const snaps = wall.filter((s) => s.media_type === "sound" && s.media_url);

  const showMediaWall =
    session?.state === "RESPONDING" && mediaBlock && (photos.length > 0 || snaps.length > 0);
  const showCue =
    session?.state === "RESPONDING" && mediaBlock && photos.length === 0 && snaps.length === 0;

  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0c0e] text-white">
        <p>Invalid link.</p>
      </div>
    );
  }

  if (showMediaWall) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="px-6 pt-6 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500">Live</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">{round?.prompt_text}</h1>
          <p className="mt-2 text-sm text-gray-400">
            {wall.length} in the room
            {mode === "approve_first" ? " · approve-first" : ""}
          </p>
        </div>

        {photos.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-2 px-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {photos.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.id}
                src={s.media_url!}
                alt=""
                className="aspect-square w-full object-cover"
              />
            ))}
          </div>
        )}

        {snaps.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-3 px-6 pb-10">
            {snaps.map((s, i) => (
              <div
                key={s.id}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--csc-accent,#CFFF81)]/50 text-xs text-[var(--csc-accent,#CFFF81)]"
              >
                snap {i + 1}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (showCue) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0e] px-6 text-center text-white">
        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
          {mediaBlock?.mediaType === "photo" ? "Selfie" : "Snap"}
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
          {round?.prompt_text}
        </h1>
        {mediaBlock?.hint ? (
          <p className="mt-4 text-lg text-gray-400">{mediaBlock.hint}</p>
        ) : null}
        <p className="mt-10 text-sm text-gray-500">Waiting for the room…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0e] px-4 py-8">
      {joinLink ? (
        <>
          <p className="mb-6 text-center text-lg font-medium text-gray-300">Scan to join</p>
          <QRCodeDisplay url={joinLink} size={QR_SIZE} highRes className="shrink-0" />
        </>
      ) : (
        <div className="h-[480px] w-[480px] animate-pulse rounded-lg bg-gray-800" />
      )}
    </div>
  );
}
