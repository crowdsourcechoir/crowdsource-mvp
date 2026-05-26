import { promises as fs } from "fs";
import path from "path";
import type { EventMemoryRecord } from "@/lib/memory/types";

const RECORDS_PATH = path.join(process.cwd(), ".data", "event-memory-records-local.json");

type LocalMemoryStore = {
  records: EventMemoryRecord[];
};

async function loadStore(): Promise<LocalMemoryStore> {
  try {
    const raw = await fs.readFile(RECORDS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalMemoryStore>;
    return { records: Array.isArray(parsed.records) ? parsed.records : [] };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return { records: [] };
    }
    throw err;
  }
}

async function saveStore(store: LocalMemoryStore): Promise<void> {
  const dir = path.dirname(RECORDS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(RECORDS_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export async function localGetLatestMemoryForEvent(eventId: string): Promise<EventMemoryRecord | null> {
  const store = await loadStore();
  const matches = store.records.filter((r) => r.eventId === eventId);
  if (!matches.length) return null;
  matches.sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
  return matches[0] ?? null;
}

export async function localListMemoryRecords(limit = 50): Promise<EventMemoryRecord[]> {
  const store = await loadStore();
  return [...store.records].sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1)).slice(0, limit);
}

export async function localUpsertMemoryRecord(record: EventMemoryRecord): Promise<EventMemoryRecord> {
  const store = await loadStore();
  const prior = store.records.filter((r) => r.eventId === record.eventId);
  const version = prior.length > 0 ? Math.max(...prior.map((r) => r.version)) + 1 : 1;
  const withVersion = { ...record, version };
  store.records = store.records.filter((r) => r.eventId !== record.eventId);
  store.records.push(withVersion);
  await saveStore(store);
  return withVersion;
}
