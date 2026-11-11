/**
 * Lyric show slides. Authored at 1920×1080, the usual projector frame,
 * then scaled to whatever screen is in front of the room.
 */

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
export const GATHER_SHOW_ID = "show_gather";
/** Live Gather Song Garden bloom (Crowdsource Choir: Gather, 3 Dec 2026). */
export const GATHER_BLOOM_ID = "aa212bdd-696b-4e91-863d-808fd60bd84c";
export const GATHER_BLOOM_SLUG = "csc-dec3";
export const LYRIC_SIZE_MIN = 36;
export const LYRIC_SIZE_MAX = 180;
/** Default mark in the upper left of a lyric slide. */
export const SHOW_LOGO_SRC = "/brand/crowdsource-choir-logo.png";

const MAX_SHOWS = 40;
const MAX_SLIDES = 40;
const MAX_LINES = 24;
const MAX_LINE = 280;
const MAX_NAME = 80;

export const LYRIC_FONTS = [
  {
    id: "fraunces",
    label: "Fraunces",
    note: "Sung lines. A soft serif that stays clear when the words are very large.",
  },
  {
    id: "bricolage",
    label: "Bricolage Grotesque",
    note: "Short chants. Heavy enough to read across a room.",
  },
  {
    id: "literata",
    label: "Literata",
    note: "Full verses. Narrower letters so more lines fit on the slide.",
  },
] as const;

export type LyricFontId = (typeof LYRIC_FONTS)[number]["id"];

export const SIZE_PRESETS = [
  { id: "huge", label: "Huge", px: 156 },
  { id: "large", label: "Large", px: 112 },
  { id: "verse", label: "Verse", px: 72 },
  { id: "tight", label: "Tight", px: 46 },
] as const;

export type ShowSlide = {
  id: string;
  lines: string[];
  font: LyricFontId;
  /** Preferred size in px at 1920×1080. The frame shrinks it when the lines need room. */
  sizePx: number;
  /** Index into the bloom's video loops. */
  loopIndex: number;
  /** Crowdsource Choir mark in the upper left. Missing values stay visible. */
  showLogo: boolean;
};

export type ShowDeck = {
  id: string;
  slug: string;
  name: string;
  builtin: boolean;
  gardenId: string | null;
  bloomId: string | null;
  /** When no bloom is locked, use the bloom whose title or slug contains this. */
  match: string | null;
  slides: ShowSlide[];
  createdAt: string;
  updatedAt: string;
};

export type ShowSlidesState = {
  shows: ShowDeck[];
};

export const EMPTY_SHOW_SLIDES: ShowSlidesState = { shows: [] };

export type LyricCue = { slide: number; revealed: number };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FONT_IDS = new Set<string>(LYRIC_FONTS.map((font) => font.id));

export function stageScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return Math.round(scale * 1000) / 1000;
}

export function lyricLineHeight(sizePx: number): number {
  if (sizePx >= 120) return 0.92;
  if (sizePx >= 72) return 1.06;
  return 1.22;
}

export function clampLyricSize(value: number): number {
  if (!Number.isFinite(value)) return 112;
  return Math.max(LYRIC_SIZE_MIN, Math.min(LYRIC_SIZE_MAX, Math.round(value)));
}

export function slugifyShow(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "show";
}

export function spokenLines(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean);
}

export function gatherShow(now = "2026-11-10T00:00:00.000Z"): ShowDeck {
  return {
    id: GATHER_SHOW_ID,
    slug: "gather",
    name: "Gather",
    builtin: true,
    gardenId: null,
    bloomId: GATHER_BLOOM_ID,
    match: "gather",
    slides: [
      {
        id: "gather-title",
        lines: ["Gather"],
        font: "fraunces",
        sizePx: 156,
        loopIndex: 0,
        showLogo: true,
      },
      {
        id: "gather-verse",
        lines: [],
        font: "literata",
        sizePx: 64,
        loopIndex: 0,
        showLogo: true,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function asFont(value: unknown): LyricFontId {
  return typeof value === "string" && FONT_IDS.has(value) ? (value as LyricFontId) : "fraunces";
}

function asId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > 80) return null;
  return id;
}

function asLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const lines: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    lines.push(item.replace(/\s+$/g, "").slice(0, MAX_LINE));
    if (lines.length >= MAX_LINES) break;
  }
  return lines;
}

export function normalizeSlide(value: unknown, index: number): ShowSlide | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ShowSlide>;
  const id = asId(raw.id) ?? `slide_${index + 1}`;
  const loop = Number(raw.loopIndex);
  return {
    id,
    lines: asLines(raw.lines),
    font: asFont(raw.font),
    sizePx: clampLyricSize(Number(raw.sizePx)),
    loopIndex: Number.isFinite(loop) ? Math.max(0, Math.min(23, Math.floor(loop))) : 0,
    showLogo: raw.showLogo !== false,
  };
}

export function normalizeShow(value: unknown): ShowDeck | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ShowDeck>;
  const id = asId(raw.id);
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_NAME) : "";
  if (!id || !name) return null;
  const slugSource = typeof raw.slug === "string" && raw.slug.trim() ? raw.slug : name;
  const slug = slugifyShow(slugSource);
  if (!SLUG_PATTERN.test(slug)) return null;
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map(normalizeSlide).filter((slide): slide is ShowSlide => Boolean(slide)).slice(0, MAX_SLIDES)
    : [];
  const seen = new Set<string>();
  const uniqueSlides = slides.filter((slide) => {
    if (seen.has(slide.id)) return false;
    seen.add(slide.id);
    return true;
  });
  if (uniqueSlides.length === 0) uniqueSlides.push(blankSlide("slide_1"));
  return {
    id,
    slug: id === GATHER_SHOW_ID ? "gather" : slug,
    name,
    builtin: id === GATHER_SHOW_ID,
    gardenId: asId(raw.gardenId),
    bloomId: asId(raw.bloomId),
    match: id === GATHER_SHOW_ID ? "gather" : asId(raw.match),
    slides: uniqueSlides,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date(0).toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
  };
}

export function blankSlide(id: string): ShowSlide {
  return { id, lines: [], font: "fraunces", sizePx: 112, loopIndex: 0, showLogo: true };
}

export function normalizeShowSlides(raw: unknown): ShowSlidesState {
  const source = (raw ?? {}) as { shows?: unknown };
  const shows = Array.isArray(source.shows) ? source.shows : [];
  const seen = new Set<string>();
  const normalized: ShowDeck[] = [];
  for (const item of shows) {
    const show = normalizeShow(item);
    if (!show || seen.has(show.id) || seen.has(show.slug)) continue;
    seen.add(show.id);
    seen.add(show.slug);
    normalized.push(show);
    if (normalized.length >= MAX_SHOWS) break;
  }
  return { shows: normalized };
}

export function listShows(state: ShowSlidesState): ShowDeck[] {
  const storedGather = state.shows.find((show) => show.id === GATHER_SHOW_ID);
  const gather = storedGather
    ? {
        ...storedGather,
        builtin: true,
        slug: "gather",
        match: "gather",
        bloomId: storedGather.bloomId || GATHER_BLOOM_ID,
      }
    : gatherShow();
  const custom = state.shows.filter((show) => show.id !== GATHER_SHOW_ID);
  return [gather, ...custom];
}

export function findShow(state: ShowSlidesState, idOrSlug: string): ShowDeck | null {
  const key = idOrSlug.trim().toLowerCase();
  return listShows(state).find((show) => show.id === idOrSlug || show.slug === key) ?? null;
}

export function nextLyricCue(
  state: LyricCue,
  slides: Array<Pick<ShowSlide, "lines">>,
  direction: "next" | "prev" | "none"
): LyricCue {
  if (direction === "none" || slides.length === 0) return state;
  const slide = Math.max(0, Math.min(slides.length - 1, Math.floor(state.slide) || 0));
  const total = spokenLines(slides[slide]?.lines ?? []).length;
  const revealed = Math.max(0, Math.min(total, Math.floor(state.revealed) || 0));
  if (direction === "next") {
    if (revealed < total) return { slide, revealed: revealed + 1 };
    const next = Math.min(slides.length - 1, slide + 1);
    if (next === slide) return { slide, revealed };
    return { slide: next, revealed: 0 };
  }
  if (revealed > 0) return { slide, revealed: revealed - 1 };
  const prev = Math.max(0, slide - 1);
  if (prev === slide) return { slide, revealed: 0 };
  const previousTotal = spokenLines(slides[prev]?.lines ?? []).length;
  return { slide: prev, revealed: previousTotal };
}

export function revealedLines(slide: Pick<ShowSlide, "lines"> | undefined, revealed: number): string[] {
  return spokenLines(slide?.lines ?? []).slice(0, Math.max(0, revealed));
}

export type BloomMatch = { id: string; slug: string; title: string };

/** Locked bloom id wins. Otherwise the first bloom whose slug or title contains the match. */
export function matchBloom<T extends BloomMatch>(
  blooms: T[],
  show: { bloomId: string | null; match: string | null }
): T | null {
  if (show.bloomId) return blooms.find((bloom) => bloom.id === show.bloomId) ?? null;
  const query = show.match?.trim().toLowerCase();
  if (!query) return null;
  return (
    blooms.find((bloom) => bloom.slug.toLowerCase().includes(query) || bloom.title.toLowerCase().includes(query)) ??
    null
  );
}

export type ShowLoop = {
  videoUrl: string | null;
  sceneUrl: string | null;
  label: string;
};

export type StoryboardPlate = {
  videoUrl?: string | null;
  sceneUrl?: string | null;
  /** Bloom frame slot, 0-based. Stored generations carry this so a later take stays tied to Frame 3. */
  frameIndex?: number;
};

function plateUrls(frame: StoryboardPlate): { videoUrl: string | null; sceneUrl: string | null } | null {
  const videoUrl = frame.videoUrl?.trim() || null;
  const sceneUrl = frame.sceneUrl?.trim() || null;
  if (!videoUrl && !sceneUrl) return null;
  return { videoUrl, sceneUrl };
}

/** Bloom storyboard order. Frame 1 is the first plate the bloom shows, video preferred over its still. */
export function loopsFromStoryboard(frames: StoryboardPlate[] | null | undefined): ShowLoop[] {
  const loops: ShowLoop[] = [];
  (frames ?? []).forEach((frame, index) => {
    const urls = plateUrls(frame);
    if (!urls) return;
    const n = (frame.frameIndex ?? index) + 1;
    loops.push({ ...urls, label: `Frame ${n}` });
  });
  return loops;
}

/**
 * Plates the bloom is using, then any stored generation that is not already on the board.
 * A garden storyboard fills in only when the bloom board itself is empty.
 * A stored video is kept even when its still is already on the board.
 */
export function accessibleBloomBackgrounds(
  board: StoryboardPlate[] | null | undefined,
  stored: StoryboardPlate[] | null | undefined,
  garden: StoryboardPlate[] | null | undefined
): ShowLoop[] {
  const onBoard = loopsFromStoryboard(board);
  const base = onBoard.length ? onBoard : loopsFromStoryboard(garden);
  const videos = new Set(base.map((loop) => loop.videoUrl).filter((url): url is string => Boolean(url)));
  const stills = new Set(base.map((loop) => loop.sceneUrl).filter((url): url is string => Boolean(url)));
  const extras: ShowLoop[] = [];
  const storedCount = new Map<number, number>();
  for (const frame of stored ?? []) {
    const urls = plateUrls(frame);
    if (!urls) continue;
    if (urls.videoUrl) {
      if (videos.has(urls.videoUrl)) continue;
      videos.add(urls.videoUrl);
    } else if (urls.sceneUrl) {
      if (stills.has(urls.sceneUrl)) continue;
      stills.add(urls.sceneUrl);
    }
    const slot = frame.frameIndex ?? extras.length;
    const count = (storedCount.get(slot) ?? 0) + 1;
    storedCount.set(slot, count);
    extras.push({
      ...urls,
      label: count === 1 ? `Frame ${slot + 1} · stored` : `Frame ${slot + 1} · stored ${count}`,
    });
  }
  return [...base, ...extras];
}

export function pickLoop(loops: ShowLoop[], index: number): ShowLoop | null {
  if (!loops.length) return null;
  const safe = Number.isFinite(index) ? Math.max(0, Math.min(loops.length - 1, Math.floor(index))) : 0;
  return loops[safe] ?? null;
}

function takenSlugs(state: ShowSlidesState, exceptId?: string): Set<string> {
  const taken = new Set<string>(["gather"]);
  for (const show of state.shows) {
    if (show.id !== exceptId) taken.add(show.slug);
  }
  return taken;
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const next = `${base.slice(0, 56)}-${n}`;
    if (!taken.has(next)) return next;
  }
  return `${base.slice(0, 40)}-${taken.size + 2}`;
}

export function createShow(
  state: ShowSlidesState,
  name: string,
  meta: { id: string; now: string }
): { state: ShowSlidesState; show: ShowDeck } | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name the show." };
  if (trimmed.length > MAX_NAME) return { error: "Keep the name under 80 characters." };
  if (state.shows.length >= MAX_SHOWS) return { error: "Forty shows is the limit for now." };
  const slug = uniqueSlug(slugifyShow(trimmed), takenSlugs(state));
  const show: ShowDeck = {
    id: meta.id,
    slug,
    name: trimmed,
    builtin: false,
    gardenId: null,
    bloomId: null,
    match: null,
    slides: [blankSlide(`${meta.id}_1`)],
    createdAt: meta.now,
    updatedAt: meta.now,
  };
  return { state: { shows: [show, ...state.shows] }, show };
}

export type ShowPatch = {
  name?: string;
  gardenId?: string | null;
  bloomId?: string | null;
  slides?: ShowSlide[];
};

export function applyShowPatch(
  state: ShowSlidesState,
  current: ShowDeck,
  patch: ShowPatch,
  now: string
): { state: ShowSlidesState; show: ShowDeck } | { error: string } {
  let name = current.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "Name the show." };
    if (trimmed.length > MAX_NAME) return { error: "Keep the name under 80 characters." };
    name = trimmed;
  }
  const slides =
    patch.slides === undefined
      ? current.slides
      : patch.slides.map(normalizeSlide).filter((slide): slide is ShowSlide => Boolean(slide)).slice(0, MAX_SLIDES);
  if (slides.length === 0) return { error: "A show needs at least one slide." };
  const seen = new Set<string>();
  for (const slide of slides) {
    if (seen.has(slide.id)) return { error: "Each slide needs its own id." };
    seen.add(slide.id);
  }
  const slug =
    current.id === GATHER_SHOW_ID
      ? "gather"
      : uniqueSlug(slugifyShow(name), takenSlugs(state, current.id));
  const show: ShowDeck = {
    ...current,
    name,
    slug,
    builtin: current.id === GATHER_SHOW_ID,
    gardenId: patch.gardenId === undefined ? current.gardenId : asId(patch.gardenId),
    bloomId: patch.bloomId === undefined ? current.bloomId : asId(patch.bloomId),
    match: current.id === GATHER_SHOW_ID ? "gather" : current.match,
    slides,
    updatedAt: now,
  };
  const others = state.shows.filter((item) => item.id !== current.id);
  return { state: { shows: [show, ...others] }, show };
}

export function removeShow(state: ShowSlidesState, show: ShowDeck): { state: ShowSlidesState } | { error: string } {
  if (show.id === GATHER_SHOW_ID) return { error: "Gather stays. Clear its lines if you want a blank opening." };
  return { state: { shows: state.shows.filter((item) => item.id !== show.id) } };
}
