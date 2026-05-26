import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { gatherCompositionInputs } from "@/lib/composition/gather-inputs";
import type { CompositionBrief } from "@/lib/composition/types";
import { localEventsGetById } from "@/lib/local-events-store";
import { localGetLatestSongSeedForEvent } from "@/lib/local-song-seeds-store";
import {
  dedupeTaggedLines,
  filterReusableExport,
  mediaRefFromTurn,
  taggedLine,
  tierForInterviewLine,
  tierForLivePhrase,
  transcriptRefFromSegment,
} from "@/lib/memory/consent";
import type {
  AssembleMemoryOptions,
  ConsentTaggedLine,
  EventMemoryMeta,
  EventMemoryRecord,
  MediaRef,
  TranscriptRef,
} from "@/lib/memory/types";
import { supabaseAdmin } from "@/lib/supabase-server";
import { extractSunoPromptsFromRow } from "@/lib/song-seed-suno";

const BRIEF_KIND = "composition_brief";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  date: string;
  time: string;
  venue: string;
};

async function loadEventMeta(eventId: string, db: SupabaseClient | null): Promise<EventMemoryMeta | null> {
  if (eventId.startsWith("local-")) {
    const row = localEventsGetById(eventId);
    if (!row) return null;
    return {
      eventId: row.id,
      slug: row.slug,
      title: row.title,
      date: row.date,
      time: row.time,
      venue: row.venue ?? "",
    };
  }

  if (!db) return null;
  const { data, error } = await db
    .from("events")
    .select("id, slug, title, date, time, venue")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as EventRow;
  return {
    eventId: row.id,
    slug: row.slug,
    title: row.title,
    date: row.date,
    time: row.time,
    venue: row.venue ?? "",
  };
}

async function resolveSessionIds(db: SupabaseClient | null, eventId: string): Promise<string[]> {
  if (!db) return [];
  const { data, error } = await db
    .from("prompt_game_sessions")
    .select("id")
    .eq("linked_event_id", eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function fetchLatestBrief(
  db: SupabaseClient | null,
  sessionIds: string[]
): Promise<CompositionBrief | null> {
  if (!db || sessionIds.length === 0) return null;

  const { data, error } = await db
    .from("prompt_game_ai_outputs")
    .select("payload")
    .in("session_id", sessionIds)
    .eq("kind", BRIEF_KIND)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return null;
  return data.payload as CompositionBrief;
}

type SongSeedSnapshot = {
  id: string;
  topThemes: string[];
  singableHooks: string[];
  emotionalToneSummary: string;
  sunoPrompts: string[];
};

async function fetchLatestSongSeed(
  eventId: string,
  db: SupabaseClient | null
): Promise<SongSeedSnapshot | null> {
  if (eventId.startsWith("local-")) {
    const seed = await localGetLatestSongSeedForEvent(eventId);
    if (!seed) return null;
    return {
      id: seed.id,
      topThemes: seed.topThemes,
      singableHooks: seed.singableHooks,
      emotionalToneSummary: seed.emotionalToneSummary,
      sunoPrompts: seed.sunoPrompts,
    };
  }

  if (!db) return null;
  const { data, error } = await db
    .from("song_seeds")
    .select("id, top_themes, singable_hooks, emotional_tone_summary, suno_prompts, source_mapping")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id as string,
    topThemes: Array.isArray(data.top_themes) ? (data.top_themes as string[]) : [],
    singableHooks: Array.isArray(data.singable_hooks) ? (data.singable_hooks as string[]) : [],
    emotionalToneSummary: (data.emotional_tone_summary as string) ?? "",
    sunoPrompts: extractSunoPromptsFromRow(data as Record<string, unknown>),
  };
}

async function fetchInterviewMediaRefs(
  eventId: string,
  db: SupabaseClient | null
): Promise<MediaRef[]> {
  const refs: MediaRef[] = [];
  if (!db || eventId.startsWith("local-")) return refs;

  const isLocalEvent = eventId.startsWith("local-");
  const { data: convs, error: convErr } = isLocalEvent
    ? await db.from("agent_conversations").select("id").eq("local_event_id", eventId)
    : await db.from("agent_conversations").select("id").eq("event_id", eventId);
  if (convErr || !convs?.length) return refs;

  const convIds = convs.map((c: { id: string }) => c.id);
  const { data: turns, error: turnErr } = await db
    .from("agent_conversation_turns")
    .select("id, audio_url, video_url")
    .in("conversation_id", convIds)
    .eq("role", "user");
  if (turnErr) throw new Error(turnErr.message);

  for (const turn of turns ?? []) {
    const audio = (turn.audio_url as string | null)?.trim();
    if (audio) refs.push(mediaRefFromTurn(turn.id as string, audio, "audio"));
    const video = (turn.video_url as string | null)?.trim();
    if (video) refs.push(mediaRefFromTurn(turn.id as string, video, "video"));
  }

  return refs;
}

function linesFromBrief(brief: CompositionBrief): {
  hooks: ConsentTaggedLine[];
  chantable: ConsentTaggedLine[];
  themes: string[];
} {
  const hooks = dedupeTaggedLines(
    brief.hookCandidates
      .map((text) =>
        taggedLine(text, "reuse_anonymous", "composition", { sourceId: brief.id })
      )
      .filter(Boolean) as ConsentTaggedLine[],
    12
  );

  const chantable = dedupeTaggedLines(
    brief.chantableLines
      .map((text) =>
        taggedLine(text, "reuse_anonymous", "composition", { sourceId: brief.id })
      )
      .filter(Boolean) as ConsentTaggedLine[],
    16
  );

  const themes = brief.lyricThemes.map((t) => t.label.trim()).filter(Boolean);

  return { hooks, chantable, themes };
}

/**
 * Assemble an Event Memory Record from Participation, Signal, and Composition sources.
 * Does not persist — call finalizeEventMemory to store.
 */
export async function assembleEventMemoryRecord(
  options: AssembleMemoryOptions,
  db: SupabaseClient | null = supabaseAdmin
): Promise<EventMemoryRecord> {
  const { eventId } = options;
  const eventMeta = await loadEventMeta(eventId, db);
  if (!eventMeta) {
    throw new Error("Event not found.");
  }

  let gather;
  try {
    gather = await gatherCompositionInputs({ eventId }, db);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Database not configured")) {
      gather = {
        eventId,
        sessionIds: [],
        textLines: [],
        transcriptSegments: [],
        phraseCards: [],
        signalResolutions: [],
        sourceCounts: {
          interviewTurns: 0,
          liveSubmissions: 0,
          signalRounds: 0,
          phraseCards: 0,
        },
      };
    } else {
      throw err;
    }
  }

  const sessionIds =
    gather.sessionIds.length > 0 ? gather.sessionIds : await resolveSessionIds(db, eventId);

  const [brief, songSeed, mediaRefs] = await Promise.all([
    fetchLatestBrief(db, sessionIds),
    fetchLatestSongSeed(eventId, db),
    fetchInterviewMediaRefs(eventId, db),
  ]);

  const lockedPhrases: ConsentTaggedLine[] = dedupeTaggedLines(
    gather.phraseCards
      .filter((c) => c.locked)
      .map((card) =>
        taggedLine(card.rawText, tierForLivePhrase(card), "live", {
          sourceId: card.id,
          voteCount: card.voteCount,
        })
      )
      .filter(Boolean) as ConsentTaggedLine[],
    24
  );

  const briefLines = brief ? linesFromBrief(brief) : { hooks: [], chantable: [], themes: [] };

  const seedHooks: ConsentTaggedLine[] = dedupeTaggedLines(
    (songSeed?.singableHooks ?? [])
      .map((text) =>
        taggedLine(text, "reuse_anonymous", "song_seed", { sourceId: songSeed?.id })
      )
      .filter(Boolean) as ConsentTaggedLine[],
    12
  );

  const hooks = dedupeTaggedLines([...briefLines.hooks, ...seedHooks], 16);
  const chantableLines = dedupeTaggedLines(
    [...briefLines.chantable, ...lockedPhrases.filter((l) => l.text.split(/\s+/).length <= 8)],
    20
  );

  const transcriptRefs: TranscriptRef[] = [
    ...gather.transcriptSegments.map(transcriptRefFromSegment),
    ...gather.textLines
      .filter((l) => l.source === "interview")
      .map((line) => ({
        turnId: line.sourceId ?? line.conversationId ?? "unknown",
        conversationId: line.conversationId,
        participantLabel: line.participantLabel,
        mediaType: "text" as const,
        tier: tierForInterviewLine(line),
      })),
  ];

  const emotionalSummary =
    brief?.creativeSummary?.trim() ||
    songSeed?.emotionalToneSummary?.trim() ||
    "";

  const themes = dedupeTaggedLines(
    [
      ...briefLines.themes.map((label) =>
        taggedLine(label, "reuse_anonymous", "composition")
      ),
      ...(songSeed?.topThemes ?? []).map((label) =>
        taggedLine(label, "reuse_anonymous", "song_seed", { sourceId: songSeed?.id })
      ),
    ].filter(Boolean) as ConsentTaggedLine[],
    16
  ).map((t) => t.text);

  const sunoPrompts = dedupeTaggedLines(
    [...(brief?.sunoPrompts ?? []), ...(songSeed?.sunoPrompts ?? [])]
      .map((text) => taggedLine(text, "reuse_anonymous", "composition"))
      .filter(Boolean) as ConsentTaggedLine[],
    6
  ).map((l) => l.text);

  const allTagged = [...hooks, ...chantableLines, ...lockedPhrases];

  const record: EventMemoryRecord = {
    id: randomUUID(),
    eventId,
    finalizedAt: new Date().toISOString(),
    finalizedBy: "joel",
    version: 1,
    eventMeta,
    sessionIds,
    anthemFragments: {
      hooks,
      chantableLines,
      lockedPhrases,
    },
    voiceSamples: {
      transcriptRefs,
      mediaRefs,
    },
    emotionalProfile: {
      summary: emotionalSummary,
      themes,
      arc: brief?.emotionalArc?.trim() ?? "",
      contrasts: [],
    },
    signalProfile: {
      resolutions: gather.signalResolutions,
      textureNotes: brief?.signalTextureNotes ?? gather.signalResolutions.map(
        (r) => `${r.layer}: ${r.label}`
      ),
    },
    compositionArtifacts: {
      songSeedId: songSeed?.id,
      compositionBriefId: brief?.id,
      sunoPrompts,
    },
    sourceCounts: gather.sourceCounts,
    reusableExport: filterReusableExport(allTagged),
  };

  return record;
}
