import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  SongGardenSubmission,
  SongGardenSubmissionStatus,
} from "@/data/songGarden";

type LocalSongGardenStore = {
  submissions: SongGardenSubmission[];
};

const STORE_PATH = path.join(process.cwd(), ".data", "song-garden-local.json");

async function loadStore(): Promise<LocalSongGardenStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalSongGardenStore>;
    return {
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
    };
  } catch (err: any) {
    if (err?.code === "ENOENT") return { submissions: [] };
    throw err;
  }
}

async function saveStore(store: LocalSongGardenStore): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export async function localSongGardenListSubmissions(eventId: string): Promise<SongGardenSubmission[]> {
  const store = await loadStore();
  return store.submissions
    .filter((submission) => submission.eventId === eventId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function localSongGardenCreateSubmission(
  input: Omit<SongGardenSubmission, "id" | "status" | "createdAt" | "processedAudioUrl">
): Promise<SongGardenSubmission> {
  const store = await loadStore();
  const submission: SongGardenSubmission = {
    ...input,
    id: randomUUID(),
    processedAudioUrl: null,
    status: "needs_review",
    createdAt: new Date().toISOString(),
  };
  store.submissions.push(submission);
  await saveStore(store);
  return submission;
}

export async function localSongGardenUpdateSubmissionStatus(
  id: string,
  status: SongGardenSubmissionStatus
): Promise<SongGardenSubmission | null> {
  const store = await loadStore();
  const index = store.submissions.findIndex((submission) => submission.id === id);
  if (index < 0) return null;
  store.submissions[index] = { ...store.submissions[index], status };
  await saveStore(store);
  return store.submissions[index];
}
