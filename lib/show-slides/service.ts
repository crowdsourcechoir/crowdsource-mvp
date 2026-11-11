import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { readWorkspaceSettings, writeWorkspaceSettings } from "@/lib/settings/store";
import {
  applyShowPatch,
  createShow,
  EMPTY_SHOW_SLIDES,
  findShow,
  listShows,
  normalizeShowSlides,
  removeShow,
  type ShowDeck,
  type ShowPatch,
  type ShowSlidesState,
} from "@/lib/show-slides/model";

const LOCAL_PATH = join(process.cwd(), ".data", "show-slides.json");

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

async function readLocal(): Promise<ShowSlidesState> {
  try {
    const text = await readFile(LOCAL_PATH, "utf8");
    return normalizeShowSlides(JSON.parse(text));
  } catch {
    return EMPTY_SHOW_SLIDES;
  }
}

async function writeLocal(state: ShowSlidesState): Promise<string | null> {
  try {
    await mkdir(join(process.cwd(), ".data"), { recursive: true });
    await writeFile(LOCAL_PATH, JSON.stringify(state, null, 2));
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Could not store the show on this machine.";
  }
}

async function readState(): Promise<{ state: ShowSlidesState; error: string | null }> {
  if (!supabaseConfigured()) {
    return { state: await readLocal(), error: null };
  }
  const stored = await readWorkspaceSettings({ skipCache: true });
  return { state: normalizeShowSlides(stored.settings.showSlides), error: stored.error };
}

async function writeState(state: ShowSlidesState): Promise<string | null> {
  const normalized = normalizeShowSlides(state);
  if (!supabaseConfigured()) return writeLocal(normalized);
  const written = await writeWorkspaceSettings({ showSlides: normalized });
  return written.error;
}

export async function listShowAdmin(): Promise<{ shows: ShowDeck[]; error: string | null }> {
  const { state, error } = await readState();
  return { shows: listShows(state), error };
}

export async function loadShow(idOrSlug: string): Promise<ShowDeck | null> {
  const { state } = await readState();
  return findShow(state, idOrSlug);
}

export async function createShowAdmin(name: string): Promise<{ show: ShowDeck | null; error: string | null; status: number }> {
  const { state, error: readError } = await readState();
  if (readError) return { show: null, error: readError, status: 503 };
  const created = createShow(state, name, {
    id: `show_${randomBytes(4).toString("hex")}`,
    now: new Date().toISOString(),
  });
  if ("error" in created) return { show: null, error: created.error, status: 400 };
  const writeError = await writeState(created.state);
  if (writeError) return { show: null, error: writeError, status: 503 };
  return { show: created.show, error: null, status: 200 };
}

export async function patchShow(
  idOrSlug: string,
  patch: ShowPatch
): Promise<{ show: ShowDeck | null; error: string | null; status: number }> {
  const { state, error: readError } = await readState();
  if (readError) return { show: null, error: readError, status: 503 };
  const current = findShow(state, idOrSlug);
  if (!current) return { show: null, error: "Show not found.", status: 404 };
  const next = applyShowPatch(state, current, patch, new Date().toISOString());
  if ("error" in next) return { show: null, error: next.error, status: 400 };
  const writeError = await writeState(next.state);
  if (writeError) return { show: null, error: writeError, status: 503 };
  return { show: next.show, error: null, status: 200 };
}

export async function deleteShow(idOrSlug: string): Promise<{ error: string | null; status: number }> {
  const { state, error: readError } = await readState();
  if (readError) return { error: readError, status: 503 };
  const current = findShow(state, idOrSlug);
  if (!current) return { error: "Show not found.", status: 404 };
  const next = removeShow(state, current);
  if ("error" in next) return { error: next.error, status: 400 };
  const writeError = await writeState(next.state);
  if (writeError) return { error: writeError, status: 503 };
  return { error: null, status: 200 };
}
