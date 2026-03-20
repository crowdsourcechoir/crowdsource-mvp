import { promises as fs } from "fs";
import path from "path";

export type LocalSongSeedPayload = {
  id: string;
  eventId: string;
  topThemes: string[];
  notableLines: string[];
  singableHooks: string[];
  shoutouts: string[];
  emotionalToneSummary: string;
  sourceMapping: unknown[];
  sunoPrompts: string[];
  createdAt: string;
};

const SEEDS_PATH = path.join(process.cwd(), ".data", "agent-song-seeds-local.json");

type LocalSeedStore = {
  seeds: LocalSongSeedPayload[];
};

async function loadStore(): Promise<LocalSeedStore> {
  try {
    const raw = await fs.readFile(SEEDS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalSeedStore>;
    return { seeds: Array.isArray(parsed.seeds) ? parsed.seeds : [] };
  } catch (err: any) {
    if (err?.code === "ENOENT") return { seeds: [] };
    throw err;
  }
}

async function saveStore(store: LocalSeedStore): Promise<void> {
  await fs.writeFile(SEEDS_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export async function localGetLatestSongSeedForEvent(eventId: string): Promise<LocalSongSeedPayload | null> {
  const store = await loadStore();
  const seeds = store.seeds.filter((s) => s.eventId === eventId);
  if (!seeds.length) return null;
  seeds.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return seeds[0] ?? null;
}

export async function localUpsertSongSeedForEvent(eventId: string, payload: LocalSongSeedPayload): Promise<void> {
  const store = await loadStore();
  store.seeds = store.seeds.filter((s) => s.eventId !== eventId);
  store.seeds.push(payload);
  await saveStore(store);
}

