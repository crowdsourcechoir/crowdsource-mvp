import { NextResponse } from "next/server";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localSongGardenListSubmissions } from "@/lib/local-song-garden-store";
import {
  isMissingSongGardenTable,
  storageListSongGardenSubmissions,
} from "@/lib/song-garden-supabase-storage";
import { slugifyAssetPart, type SongGardenSubmission } from "@/data/songGarden";

type ToneGroup = {
  folder: string;
  label: string;
  midiNote: number;
  pitch: string;
};

const TONE_GROUPS: Record<string, ToneGroup> = {
  "ahh-c": {
    folder: "Ableton_Ready/Choir_Tones/01_Degree_1_Root_C",
    label: "Degree 1 / Root / C",
    midiNote: 60,
    pitch: "C4",
  },
  "ohh-f": {
    folder: "Ableton_Ready/Choir_Tones/02_Degree_4_F",
    label: "Degree 4 / F",
    midiNote: 65,
    pitch: "F4",
  },
  "ahh-g": {
    folder: "Ableton_Ready/Choir_Tones/03_Degree_5_G",
    label: "Degree 5 / G",
    midiNote: 67,
    pitch: "G4",
  },
  "ohh-a": {
    folder: "Ableton_Ready/Choir_Tones/04_Degree_6_A",
    label: "Degree 6 / A",
    midiNote: 69,
    pitch: "A4",
  },
};

function rowToSubmission(row: Record<string, unknown>): SongGardenSubmission {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventSlug: String(row.event_slug ?? ""),
    participantName: row.participant_name ? String(row.participant_name) : null,
    promptId: String(row.prompt_id),
    promptTitle: String(row.prompt_title),
    soundType: String(row.sound_type) as SongGardenSubmission["soundType"],
    assetCategory: String(row.asset_category) as SongGardenSubmission["assetCategory"],
    pitch: row.pitch ? String(row.pitch) : null,
    midiNote: typeof row.midi_note === "number" ? row.midi_note : null,
    consentStatus: Boolean(row.consent_status),
    textResponse: row.text_response ? String(row.text_response) : null,
    rawAudioUrl: row.raw_audio_url ? String(row.raw_audio_url) : null,
    processedAudioUrl: row.processed_audio_url ? String(row.processed_audio_url) : null,
    status: row.status === "approved" || row.status === "rejected" ? row.status : "needs_review",
    createdAt: String(row.created_at),
  };
}

async function listSubmissions(eventId: string): Promise<SongGardenSubmission[]> {
  if (!supabaseAdmin) return localSongGardenListSubmissions(eventId);
  const { data, error } = await supabaseAdmin
    .from("song_garden_submissions")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (isMissingSongGardenTable(error)) return storageListSongGardenSubmissions(eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSubmission);
}

function escapeCsv(input: string | null | undefined): string {
  const value = input ?? "";
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function extFromAudioUrl(url: string): string {
  if (url.startsWith("data:audio/webm")) return "webm";
  if (url.startsWith("data:audio/wav")) return "wav";
  if (url.startsWith("data:audio/ogg")) return "ogg";
  const clean = url.split("?")[0] ?? "";
  const ext = clean.split(".").pop()?.toLowerCase();
  return ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : "webm";
}

async function audioToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:[^;,]+;base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL.");
    return Buffer.from(match[1], "base64");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch audio ${res.status}.`);
  return Buffer.from(await res.arrayBuffer());
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value, 0);
  return buffer;
}

function uint16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16BE(value, 0);
  return buffer;
}

function varLen(value: number): Buffer {
  let buffer = value & 0x7f;
  const bytes = [buffer];
  while ((value >>= 7)) {
    buffer = (value & 0x7f) | 0x80;
    bytes.unshift(buffer);
  }
  return Buffer.from(bytes);
}

function midiFile(note: number, bpm: number): Buffer {
  const tempo = Math.round(60_000_000 / Math.max(1, bpm));
  const tempoBytes = Buffer.from([(tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff]);
  const track = Buffer.concat([
    varLen(0),
    Buffer.from([0xff, 0x51, 0x03]),
    tempoBytes,
    varLen(0),
    Buffer.from([0x90, Math.max(0, Math.min(127, note)), 0x64]),
    varLen(480 * 4),
    Buffer.from([0x80, Math.max(0, Math.min(127, note)), 0x40]),
    varLen(0),
    Buffer.from([0xff, 0x2f, 0x00]),
  ]);
  return Buffer.concat([
    Buffer.from("MThd"),
    uint32(6),
    uint16(0),
    uint16(1),
    uint16(480),
    Buffer.from("MTrk"),
    uint32(track.length),
    track,
  ]);
}

function midiProgressionFile(notes: number[], bpm: number): Buffer {
  const tempo = Math.round(60_000_000 / Math.max(1, bpm));
  const tempoBytes = Buffer.from([(tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff]);
  const events: Buffer[] = [
    varLen(0),
    Buffer.from([0xff, 0x51, 0x03]),
    tempoBytes,
  ];
  for (const rawNote of notes) {
    const note = Math.max(0, Math.min(127, rawNote));
    events.push(varLen(0), Buffer.from([0x90, note, 0x64]));
    events.push(varLen(480 * 4), Buffer.from([0x80, note, 0x40]));
  }
  events.push(varLen(0), Buffer.from([0xff, 0x2f, 0x00]));
  const track = Buffer.concat(events);
  return Buffer.concat([
    Buffer.from("MThd"),
    uint32(6),
    uint16(0),
    uint16(1),
    uint16(480),
    Buffer.from("MTrk"),
    uint32(track.length),
    track,
  ]);
}

function folderForSubmission(submission: SongGardenSubmission): string {
  const toneGroup = TONE_GROUPS[submission.promptId];
  if (toneGroup) return toneGroup.folder;
  if (submission.promptId === "say-anything") return "Ableton_Ready/Vocal_Chops/Open_Sound_Seeds";
  if (submission.assetCategory === "vocal_chops") return "Ableton_Ready/Vocal_Chops/One_Shots";
  if (submission.assetCategory === "breath_textures") return "Ableton_Ready/Vocal_Chops/Breath_Textures";
  if (submission.assetCategory === "choir_samples") return "Ableton_Ready/Choir_Tones/Unsorted_Choir";
  return "Ableton_Ready/Source_Audio";
}

function abletonName(index: number, submission: SongGardenSubmission): string {
  const toneGroup = TONE_GROUPS[submission.promptId];
  const prefix = String(index + 1).padStart(3, "0");
  if (toneGroup) return `${prefix}_${slugifyAssetPart(toneGroup.label)}_${slugifyAssetPart(submission.participantName)}`;
  return `${prefix}_${slugifyAssetPart(submission.promptTitle)}_${slugifyAssetPart(submission.participantName)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const bpm = Number(searchParams.get("bpm") ?? "96") || 96;
  const submissions = (await listSubmissions(eventId)).filter((submission) => submission.status === "approved");
  const zip = new JSZip();
  const manifest: string[] = [
    "submission_id,prompt_id,prompt_title,sound_type,asset_category,pitch,tone_group,status,created_at,filename",
  ];
  const toneCounts = new Map<string, number>();
  const chopCounts = new Map<string, number>();
  const textResponses: string[] = [];

  for (let index = 0; index < submissions.length; index++) {
    const submission = submissions[index];
    const toneGroup = TONE_GROUPS[submission.promptId] ?? null;
    const base = abletonName(index, submission);
    const audioUrl = submission.processedAudioUrl || submission.rawAudioUrl;
    let filename = "";

    if (audioUrl) {
      const ext = extFromAudioUrl(audioUrl);
      const folder = folderForSubmission(submission);
      filename = `${folder}/${base}.${ext}`;
      try {
        zip.file(filename, await audioToBuffer(audioUrl));
        if (toneGroup) {
          toneCounts.set(toneGroup.label, (toneCounts.get(toneGroup.label) ?? 0) + 1);
        } else if (folder.includes("Vocal_Chops")) {
          chopCounts.set(submission.promptTitle, (chopCounts.get(submission.promptTitle) ?? 0) + 1);
        }
      } catch (err) {
        filename = `FETCH_FAILED:${audioUrl.slice(0, 80)}`;
      }
    }

    const midiNote = toneGroup?.midiNote ?? submission.midiNote;
    if (midiNote !== null && midiNote !== undefined && submission.assetCategory !== "text_responses") {
      zip.file(`Ableton_Ready/MIDI/Single_Notes/${base}.mid`, midiFile(midiNote, bpm));
    }

    if (submission.textResponse) {
      textResponses.push(`${submission.promptTitle} / ${submission.participantName ?? "Anonymous"}: ${submission.textResponse}`);
    }

    manifest.push(
      [
        submission.id,
        submission.promptId,
        submission.promptTitle,
        submission.soundType,
        submission.assetCategory,
        toneGroup?.pitch ?? submission.pitch ?? "",
        toneGroup?.label ?? "",
        submission.status,
        submission.createdAt,
        filename,
      ].map(escapeCsv).join(",")
    );
  }

  zip.file("manifest.csv", manifest.join("\n"));
  zip.file("Text_Responses/responses.txt", textResponses.join("\n"));
  zip.file(
    "Ableton_Ready/MIDI/Progressions/C_G_A_F_single_notes.mid",
    midiProgressionFile([60, 67, 69, 65], bpm)
  );
  zip.file(
    "Ableton_Ready/MIDI/Chord_Tones/01_Degree_1_Root_C.mid",
    midiFile(60, bpm)
  );
  zip.file("Ableton_Ready/MIDI/Chord_Tones/02_Degree_4_F.mid", midiFile(65, bpm));
  zip.file("Ableton_Ready/MIDI/Chord_Tones/03_Degree_5_G.mid", midiFile(67, bpm));
  zip.file("Ableton_Ready/MIDI/Chord_Tones/04_Degree_6_A.mid", midiFile(69, bpm));
  zip.file(
    "Ableton_Ready/README.txt",
    [
      "Song Garden Ableton export",
      "",
      "Choir_Tones contains one folder per harvested chord tone / scale degree.",
      "Drag each folder into Sampler, Simpler, or a Drum Rack slot depending on your template.",
      "Vocal_Chops contains breath, rhythm, whisper, and open sound seed material for slicing.",
      "MIDI/Chord_Tones contains single-note MIDI clips for each harvested tone.",
      "MIDI/Progressions/C_G_A_F_single_notes.mid follows the event chord-tone order 1-5-6-4.",
      "",
      "Choir tone counts:",
      ...Object.entries(TONE_GROUPS).map(([, group]) => `- ${group.label}: ${toneCounts.get(group.label) ?? 0}`),
      "",
      "Vocal chop counts:",
      ...(chopCounts.size > 0
        ? Array.from(chopCounts.entries()).map(([label, count]) => `- ${label}: ${count}`)
        : ["- none"]),
    ].join("\n")
  );

  const body = await zip.generateAsync({ type: "arraybuffer" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="song-garden-${eventId}-performance-assets.zip"`,
    },
  });
}
