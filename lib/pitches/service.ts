import { randomBytes } from "crypto";
import type { PitchSlide } from "@/app/sobeca-song-garden/content";
import { applyStoredCopy } from "@/lib/sobeca-pitch/copy";
import { hashPitchPassword, passwordHashFrom, writePitchPassword } from "@/lib/sobeca-pitch/access";
import { readWorkspaceSettings, writeWorkspaceSettings } from "@/lib/settings/store";
import {
  applyPassword,
  applyPitchPatch,
  createCustomPitch,
  duplicatePitch,
  findLoadedPitch,
  listLoadedPitches,
  normalizeWebPitches,
  SOBECA_PITCH_ID,
  toAdmin,
  type LoadedPitch,
  type PitchAdmin,
  type WebPitchesState,
} from "@/lib/pitches/model";

type PitchContext = {
  state: WebPitchesState;
  sobeca: { slides: PitchSlide[]; passwordHash: string | null };
  error: string | null;
};

async function readContext(): Promise<PitchContext> {
  const stored = await readWorkspaceSettings({ skipCache: true });
  return {
    state: normalizeWebPitches(stored.settings.webPitches),
    sobeca: {
      slides: applyStoredCopy(stored.settings.songGarden).slides,
      passwordHash: passwordHashFrom(stored.settings.songGarden),
    },
    error: stored.error,
  };
}

function newId(): string {
  return `pitch_${randomBytes(4).toString("hex")}`;
}

function now(): string {
  return new Date().toISOString();
}

async function writeState(state: WebPitchesState): Promise<string | null> {
  const written = await writeWorkspaceSettings({ webPitches: state });
  return written.error;
}

export async function listPitchAdmin(): Promise<{ pitches: PitchAdmin[]; error: string | null }> {
  const context = await readContext();
  return {
    pitches: listLoadedPitches(context.state, context.sobeca).map(toAdmin),
    error: context.error,
  };
}

export async function loadPitch(idOrSlug: string): Promise<LoadedPitch | null> {
  const context = await readContext();
  return findLoadedPitch(context.state, idOrSlug, context.sobeca);
}

async function saveSobecaSlides(slides: PitchSlide[] | null): Promise<{ slides: PitchSlide[]; error: string | null }> {
  const current = await readWorkspaceSettings({ skipCache: true });
  const passwordHash = passwordHashFrom(current.settings.songGarden);
  const slidesOnly = slides === null ? undefined : applyStoredCopy({ slides }).slides;
  const songGarden =
    slidesOnly === undefined && !passwordHash
      ? null
      : {
          ...(slidesOnly !== undefined ? { slides: slidesOnly } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        };
  const written = await writeWorkspaceSettings({ songGarden });
  return { slides: applyStoredCopy(written.settings.songGarden).slides, error: written.error };
}

export async function createPitch(input: {
  name: string;
  prompt: string;
  live?: boolean;
  password?: string;
}): Promise<{ pitch?: PitchAdmin; error?: string; status: number }> {
  const context = await readContext();
  if (context.error) return { error: context.error, status: 503 };
  const password = typeof input.password === "string" ? input.password.trim() : "";
  const created = createCustomPitch(
    context.state,
    {
      name: input.name,
      prompt: input.prompt,
      live: input.live !== false,
      passwordHash: password ? hashPitchPassword(password) : null,
    },
    { id: newId(), now: now() }
  );
  if ("error" in created) return { error: created.error, status: 400 };
  const error = await writeState(created.state);
  if (error) return { error, status: 503 };
  const pitch = findLoadedPitch(created.state, created.pitch.id, context.sobeca);
  return { pitch: pitch ? toAdmin(pitch) : undefined, status: 200 };
}

export async function duplicatePitchById(id: string): Promise<{ pitch?: PitchAdmin; error?: string; status: number }> {
  const context = await readContext();
  if (context.error) return { error: context.error, status: 503 };
  const source = findLoadedPitch(context.state, id, context.sobeca);
  if (!source) return { error: "That pitch was not found.", status: 404 };
  const copied = duplicatePitch(context.state, source, { id: newId(), now: now() });
  if ("error" in copied) return { error: copied.error, status: 400 };
  const error = await writeState(copied.state);
  if (error) return { error, status: 503 };
  const pitch = findLoadedPitch(copied.state, copied.pitch.id, context.sobeca);
  return { pitch: pitch ? toAdmin(pitch) : undefined, status: 200 };
}

export async function updatePitch(
  id: string,
  patch: { name?: string; prompt?: string; live?: boolean; slides?: unknown; reset?: boolean }
): Promise<{ pitch?: PitchAdmin; error?: string; status: number }> {
  const context = await readContext();
  if (context.error) return { error: context.error, status: 503 };
  const current = findLoadedPitch(context.state, id, context.sobeca);
  if (!current) return { error: "That pitch was not found.", status: 404 };

  let working = current;
  let state = context.state;
  if (current.id === SOBECA_PITCH_ID && (patch.reset || patch.slides !== undefined)) {
    const saved = await saveSobecaSlides(patch.reset ? null : (patch.slides as PitchSlide[]));
    if (saved.error) return { error: saved.error, status: 503 };
    working = { ...current, slides: saved.slides };
  }

  const applied = applyPitchPatch(
    state,
    working,
    current.id === SOBECA_PITCH_ID ? { ...patch, slides: undefined, reset: false } : patch,
    now()
  );
  if ("error" in applied) return { error: applied.error, status: 400 };
  const error = await writeState(applied.state);
  if (error) return { error, status: 503 };
  const fresh = await readContext();
  const pitch = findLoadedPitch(fresh.state, current.id, fresh.sobeca);
  return { pitch: pitch ? toAdmin(pitch) : toAdmin(applied.pitch), status: 200 };
}

export async function setPitchPassword(
  id: string,
  password: string | null
): Promise<{ error?: string; protected?: boolean; status: number }> {
  const context = await readContext();
  if (context.error) return { error: context.error, status: 503 };
  const current = findLoadedPitch(context.state, id, context.sobeca);
  if (!current) return { error: "That pitch was not found.", status: 404 };

  if (current.id === SOBECA_PITCH_ID) {
    const written = await writePitchPassword(password);
    if (written.error) return { error: written.error, status: 503 };
    return { protected: Boolean(password && password.trim()), status: 200 };
  }

  const passwordHash = password && password.trim() ? hashPitchPassword(password.trim()) : null;
  const applied = applyPassword(context.state, current, passwordHash);
  const error = await writeState(applied.state);
  if (error) return { error, status: 503 };
  return { protected: Boolean(passwordHash), status: 200 };
}
