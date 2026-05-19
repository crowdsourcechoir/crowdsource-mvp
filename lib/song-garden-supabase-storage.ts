import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import type {
  SongGardenSubmission,
  SongGardenSubmissionStatus,
} from "@/data/songGarden";

export const SONG_GARDEN_BUCKET = process.env.SUPABASE_SONG_GARDEN_BUCKET || "song-garden-media";

let bucketChecked = false;

export function isMissingSongGardenTable(error: { message?: string } | null | undefined): boolean {
  return !!error?.message && /song_garden_submissions/i.test(error.message) && /schema cache|could not find/i.test(error.message);
}

export async function ensureSongGardenBucket() {
  if (!supabaseAdmin || bucketChecked) return;
  bucketChecked = true;
  const { data: existing, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) return;
  if (!existing?.some((bucket) => bucket.name === SONG_GARDEN_BUCKET)) {
    await supabaseAdmin.storage.createBucket(SONG_GARDEN_BUCKET, { public: true });
  }
}

function metadataPath(eventId: string, submissionId: string): string {
  return `events/${eventId}/submissions/${submissionId}.json`;
}

function normalizeSubmission(input: SongGardenSubmission): SongGardenSubmission {
  return {
    ...input,
    processedAudioUrl: input.processedAudioUrl ?? null,
    pitch: input.pitch ?? null,
    midiNote: input.midiNote ?? null,
    participantName: input.participantName ?? null,
    textResponse: input.textResponse ?? null,
    rawAudioUrl: input.rawAudioUrl ?? null,
    status: input.status === "approved" || input.status === "rejected" ? input.status : "needs_review",
  };
}

export async function storageListSongGardenSubmissions(eventId: string): Promise<SongGardenSubmission[]> {
  if (!supabaseAdmin) return [];
  await ensureSongGardenBucket();
  const prefix = `events/${eventId}/submissions`;
  const { data: files, error } = await supabaseAdmin.storage.from(SONG_GARDEN_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !files) return [];

  const submissions: SongGardenSubmission[] = [];
  for (const file of files) {
    if (!file.name.endsWith(".json")) continue;
    const { data, error: downloadErr } = await supabaseAdmin.storage
      .from(SONG_GARDEN_BUCKET)
      .download(`${prefix}/${file.name}`);
    if (downloadErr || !data) continue;
    try {
      const parsed = JSON.parse(await data.text()) as SongGardenSubmission;
      submissions.push(normalizeSubmission(parsed));
    } catch {
      // Ignore malformed fallback records.
    }
  }
  return submissions.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function storageCreateSongGardenSubmission(
  input: Omit<SongGardenSubmission, "id" | "status" | "createdAt" | "processedAudioUrl">
): Promise<SongGardenSubmission> {
  if (!supabaseAdmin) throw new Error("Database not configured.");
  await ensureSongGardenBucket();
  const submission = normalizeSubmission({
    ...input,
    id: randomUUID(),
    processedAudioUrl: null,
    status: "needs_review",
    createdAt: new Date().toISOString(),
  });
  const { error } = await supabaseAdmin.storage
    .from(SONG_GARDEN_BUCKET)
    .upload(metadataPath(submission.eventId, submission.id), JSON.stringify(submission, null, 2), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(error.message);
  return submission;
}

export async function storageUpdateSongGardenSubmissionStatus(args: {
  eventId: string;
  submissionId: string;
  status: SongGardenSubmissionStatus;
}): Promise<SongGardenSubmission | null> {
  if (!supabaseAdmin) return null;
  await ensureSongGardenBucket();
  const path = metadataPath(args.eventId, args.submissionId);
  const { data, error } = await supabaseAdmin.storage.from(SONG_GARDEN_BUCKET).download(path);
  if (error || !data) return null;
  const parsed = normalizeSubmission(JSON.parse(await data.text()) as SongGardenSubmission);
  const next = normalizeSubmission({ ...parsed, status: args.status });
  const { error: uploadErr } = await supabaseAdmin.storage.from(SONG_GARDEN_BUCKET).upload(path, JSON.stringify(next, null, 2), {
    contentType: "application/json",
    upsert: true,
  });
  if (uploadErr) throw new Error(uploadErr.message);
  return next;
}
