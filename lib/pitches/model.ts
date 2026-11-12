import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { INITIAL_MEETING_NAME, INITIAL_MEETING_PROMPT, initialMeetingSlides } from "@/lib/pitches/initial-meeting";
import { STRATEGY_NAME, STRATEGY_PROMPT, strategySlides } from "@/lib/pitches/strategy";
import { VISIT_BELLEVUE_NAME, VISIT_BELLEVUE_PROMPT, visitBellevueSlides } from "@/lib/pitches/visit-bellevue";
import { overlayColor as storedOverlayColor } from "@/lib/pitches/photo-overlay";

const DEFAULT_COPY_COLOR = "#FFFFFF";

function safeCopyColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_COPY_COLOR;
  const color = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(color) ? color.toUpperCase() : DEFAULT_COPY_COLOR;
}

export const SOBECA_PITCH_ID = "sobeca-song-garden";
export const INITIAL_MEETING_ID = "initial-meeting";
export const STRATEGY_ID = "strategy";
export const VISIT_BELLEVUE_ID = "visit-bellevue";

export const SOBECA_PITCH_PROMPT =
  "Public pitch for the SoBECA Song Garden: a living participatory arts initiative for the arts district, and an invitation to create it together.";

const MAX_CUSTOM = 40;
const MAX_TEXT = 4000;
const MAX_PROMPT = 2000;
const MAX_NAME = 80;

export type PitchAdmin = {
  id: string;
  slug: string;
  name: string;
  title: string;
  prompt: string;
  live: boolean;
  protected: boolean;
  href: string;
  builtin: boolean;
  organizationId: string | null;
  /** Resolved when the pitch is read for admin. Not stored on the pitch. */
  organizationName: string | null;
  slides: PitchSlide[];
};

export type LoadedPitch = Omit<PitchAdmin, "protected" | "organizationName"> & {
  passwordHash: string | null;
};

export type PitchOverride = {
  name?: string;
  prompt?: string;
  /** Public address segment. The page is /pitch/{slug}, except SoBECA's own path. */
  slug?: string;
  live?: boolean;
  slides?: PitchSlide[] | null;
  passwordHash?: string | null;
  /** Sales organization. Null clears a previous link. */
  organizationId?: string | null;
};

export type CustomPitch = {
  id: string;
  slug: string;
  name: string;
  prompt: string;
  live: boolean;
  passwordHash: string | null;
  organizationId: string | null;
  slides: PitchSlide[];
  createdAt: string;
  updatedAt: string;
};

export type WebPitchesState = {
  overrides: Record<string, PitchOverride>;
  custom: CustomPitch[];
};

export const EMPTY_WEB_PITCHES: WebPitchesState = { overrides: {}, custom: [] };

const WASH = "/pitch/shared/wash.jpg";
const SEED_PHOTO = "/pitch/initial-meeting/concert.jpg";

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "pitch";
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Public path for a pitch. SoBECA keeps its own page until its address is changed. */
export function hrefForPitch(id: string, slug: string): string {
  if (id === SOBECA_PITCH_ID && slug === SOBECA_PITCH_ID) return "/sobeca-song-garden";
  return `/pitch/${slug}`;
}

/**
 * Accept a path, a /pitch/slug, or a bare slug.
 * SoBECA may also stay at /sobeca-song-garden.
 */
export function parsePitchUrl(input: string, pitchId: string): { slug: string } | { error: string } {
  let path = input.trim().toLowerCase();
  path = path.replace(/^https?:\/\/[^/]+/i, "");
  const query = path.search(/[?#]/);
  if (query >= 0) path = path.slice(0, query);
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/+$/, "");
  if (pitchId === SOBECA_PITCH_ID && path === "/sobeca-song-garden") return { slug: SOBECA_PITCH_ID };
  const prefixed = path.match(/^\/pitch\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  const slug = prefixed ? prefixed[1] : path.replace(/^\//, "");
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) {
    return { error: "Use a short path like /pitch/anthem." };
  }
  if (slug === SOBECA_PITCH_ID && pitchId !== SOBECA_PITCH_ID) {
    return { error: "That address belongs to SoBECA Song Garden." };
  }
  return { slug };
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || "pitch";
  if (!taken.has(root)) return root;
  for (let n = 2; n < 1000; n += 1) {
    const next = `${root.slice(0, 56)}-${n}`;
    if (!taken.has(next)) return next;
  }
  return `${root.slice(0, 40)}-${taken.size + 2}`;
}

export function pitchTitle(slides: PitchSlide[], fallback: string): string {
  for (const slide of slides) {
    for (const block of slide.blocks) {
      if ((block.type === "title" || block.type === "heading") && block.text.trim()) {
        return block.text.trim().slice(0, 140);
      }
    }
  }
  return fallback;
}

export function pitchDescription(slides: PitchSlide[], fallback: string): string {
  for (const slide of slides) {
    for (const block of slide.blocks) {
      if ((block.type === "paragraph" || block.type === "line") && block.text.trim()) {
        return block.text.trim().slice(0, 180);
      }
    }
  }
  return fallback;
}

export function toAdmin(pitch: LoadedPitch): PitchAdmin {
  return {
    id: pitch.id,
    slug: pitch.slug,
    name: pitch.name,
    title: pitch.title,
    prompt: pitch.prompt,
    live: pitch.live,
    protected: Boolean(pitch.passwordHash),
    href: pitch.href,
    builtin: pitch.builtin,
    organizationId: pitch.organizationId,
    organizationName: null,
    slides: pitch.slides,
  };
}

function safeImage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("..")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return url;
  } catch {
    return fallback;
  }
  return fallback;
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function washFrom(value: unknown, fallback?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value < 0 || value > 0.85) return fallback;
  return Math.round(value * 100) / 100;
}

function isBlock(value: unknown): value is CopyBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as CopyBlock;
  if (block.type === "list") {
    return Array.isArray(block.items) && block.items.every((item) => typeof item === "string" && item.length <= MAX_TEXT);
  }
  if (block.type === "table") {
    return (
      Array.isArray(block.headers) &&
      block.headers.every((header) => typeof header === "string" && header.length <= 200) &&
      Array.isArray(block.rows) &&
      block.rows.every(
        (row) => Array.isArray(row) && row.every((cell) => typeof cell === "string" && cell.length <= MAX_TEXT)
      )
    );
  }
  if (block.type === "image") {
    return typeof block.src === "string" && typeof block.alt === "string" && block.alt.length <= 300;
  }
  return "text" in block && typeof block.text === "string" && block.text.length <= MAX_TEXT;
}

export function isPitchSlide(value: unknown): value is PitchSlide {
  if (!value || typeof value !== "object") return false;
  const slide = value as PitchSlide;
  return (
    typeof slide.id === "string" &&
    /^[a-z0-9-]{1,40}$/.test(slide.id) &&
    typeof slide.image === "string" &&
    typeof slide.imageAlt === "string" &&
    slide.imageAlt.length <= 300 &&
    Array.isArray(slide.blocks) &&
    slide.blocks.length > 0 &&
    slide.blocks.length <= 40 &&
    slide.blocks.every(isBlock)
  );
}

function revealMode(value: unknown): "steps" | undefined {
  return value === "steps" ? "steps" : undefined;
}

function bottomCopy(value: unknown): string | undefined {
  return clip(value, MAX_TEXT) ?? undefined;
}

function salmonOverlay(value: unknown): "salmon" | undefined {
  return value === "salmon" ? "salmon" : undefined;
}

function overlayAmount(value: unknown, overlay: "salmon" | undefined): number | undefined {
  if (overlay !== "salmon" || typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

function copyBlock(block: CopyBlock): CopyBlock {
  if (block.type === "list") return { ...block, items: block.items.slice() };
  if (block.type === "table") {
    return { ...block, headers: block.headers.slice(), rows: block.rows.map((row) => row.slice()) };
  }
  if (!("text" in block)) return block;
  const bold = block.bold === true ? { bold: true as const } : {};
  if (block.type === "paragraph") {
    return { type: "paragraph", text: block.text, ...bold, ...(block.rule === true ? { rule: true as const } : {}) };
  }
  return { type: block.type, text: block.text, ...bold };
}

function sanitizeSlides(value: unknown): PitchSlide[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const slides = value.filter(isPitchSlide).map((slide) => {
    const grade = salmonOverlay(slide.photoOverlay);
    return {
      ...slide,
      image: safeImage(slide.image, SEED_PHOTO),
      wash: washFrom(slide.wash),
      copyColor: typeof slide.copyColor === "string" ? safeCopyColor(slide.copyColor) : undefined,
      reveal: revealMode(slide.reveal),
      bottom: bottomCopy(slide.bottom),
      photoOverlay: grade,
      photoOverlayAmount: overlayAmount(slide.photoOverlayAmount, grade),
      photoOverlayColor: grade ? storedOverlayColor(slide.photoOverlayColor) : undefined,
      blocks: slide.blocks.map(copyBlock),
    };
  });
  if (slides.length !== value.length) return null;
  const ids = new Set(slides.map((slide) => slide.id));
  if (ids.size !== slides.length) return null;
  return slides;
}

/** The editor's full deck: added and deleted slides and blocks are kept. */
export function acceptSlides(value: unknown): PitchSlide[] | null {
  return sanitizeSlides(value);
}

const TEXT_STYLES = new Set(["kicker", "title", "heading", "heading2", "heading3", "paragraph", "line"]);

function overlayBlock(base: CopyBlock, incoming: unknown): CopyBlock {
  if (!incoming || typeof incoming !== "object") return base;
  const next = incoming as CopyBlock;
  if (
    TEXT_STYLES.has(base.type) &&
    TEXT_STYLES.has(next.type) &&
    "text" in next &&
    typeof next.text === "string"
  ) {
    return {
      type: next.type,
      text: next.text.slice(0, MAX_TEXT),
      ...(next.bold === true ? { bold: true as const } : {}),
      ...(next.type === "paragraph" && next.rule === true ? { rule: true as const } : {}),
    } as CopyBlock;
  }
  if (next.type !== base.type) return base;

  if (base.type === "list" && next.type === "list" && Array.isArray(next.items) && next.items.length === base.items.length) {
    return {
      ...base,
      items: base.items.map((item, index) =>
        typeof next.items[index] === "string" ? next.items[index].slice(0, MAX_TEXT) : item
      ),
    };
  }

  if (base.type === "table" && next.type === "table" && Array.isArray(next.rows)) {
    return {
      ...base,
      headers: base.headers.map((header, index) =>
        typeof next.headers?.[index] === "string" ? next.headers[index].slice(0, 200) : header
      ),
      rows: base.rows.map((row, rowIndex) =>
        row.map((cell, cellIndex) => {
          const value = next.rows?.[rowIndex]?.[cellIndex];
          return typeof value === "string" ? value.slice(0, MAX_TEXT) : cell;
        })
      ),
    };
  }

  if ("text" in base && "text" in next && typeof next.text === "string") {
    return { ...base, text: next.text.slice(0, MAX_TEXT) };
  }

  if (base.type === "image" && next.type === "image") {
    return {
      ...base,
      alt: typeof next.alt === "string" ? next.alt.slice(0, 300) : base.alt,
      src: safeImage(next.src, base.src),
    };
  }

  return base;
}

/** Keep the deck's structure. Saved words, photos, and copy color replace the defaults. */
export function mergeSlides(base: PitchSlide[], incoming: unknown): PitchSlide[] {
  const stored = Array.isArray(incoming) ? incoming : [];
  return base.map((slide) => {
    const match = stored.find(
      (item) => item && typeof item === "object" && (item as PitchSlide).id === slide.id
    ) as PitchSlide | undefined;
    if (!match) return { ...slide, blocks: slide.blocks.map((block) => ({ ...block })) };
    return {
      ...slide,
      image: safeImage(match.image, slide.image),
      imageAlt: typeof match.imageAlt === "string" && match.imageAlt.trim() ? match.imageAlt.trim().slice(0, 300) : slide.imageAlt,
      copyColor: typeof match.copyColor === "string" ? safeCopyColor(match.copyColor) : slide.copyColor,
      bottom: bottomCopy(match.bottom),
      wash: washFrom(match.wash, slide.wash),
      blocks: slide.blocks.map((block, index) => overlayBlock(block, match.blocks?.[index])),
    };
  });
}

export function seedSlides(name: string, prompt: string): PitchSlide[] {
  const title = name.trim().slice(0, MAX_NAME) || "New pitch";
  const brief = prompt.trim().slice(0, MAX_PROMPT) || "A new Crowdsource Choir pitch.";
  return [
    {
      id: "title",
      image: SEED_PHOTO,
      imageAlt: "A concert crowd with hands raised toward a band and neon screens",
      wash: 0.28,
      blocks: [
        { type: "title", text: title },
        { type: "kicker", text: "Pitch" },
        { type: "paragraph", text: brief },
        { type: "line", text: title },
      ],
    },
    {
      id: "invitation",
      image: WASH,
      imageAlt: "Magenta and teal color washing across a dark field",
      wash: 0.45,
      blocks: [
        { type: "heading", text: "What could we create together?" },
        { type: "paragraph", text: brief },
        { type: "line", text: "Make the moment undeniable." },
      ],
    },
  ];
}

function cloneSlides(slides: PitchSlide[]): PitchSlide[] {
  return slides.map((slide) => ({
    ...slide,
    blocks: slide.blocks.map((block) =>
      block.type === "list"
        ? { ...block, items: block.items.slice() }
        : block.type === "table"
          ? { ...block, headers: block.headers.slice(), rows: block.rows.map((row) => row.slice()) }
          : { ...block }
    ),
  }));
}

function hashOrNull(value: unknown): string | null {
  return typeof value === "string" && value.includes(":") ? value : null;
}

const ORG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A sales organization id, null when the link is cleared, or undefined when the value is absent. */
export function organizationIdFrom(value: unknown): string | null | undefined {
  if (value == null) return value === null ? null : undefined;
  if (typeof value !== "string") return undefined;
  const id = value.trim().toLowerCase();
  if (!id) return undefined;
  return ORG_ID.test(id) ? id : undefined;
}

function sanitizeOverride(value: unknown): PitchOverride | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as PitchOverride;
  const override: PitchOverride = {};
  const name = clip(source.name, MAX_NAME);
  const prompt = clip(source.prompt, MAX_PROMPT);
  if (name) override.name = name;
  if (prompt) override.prompt = prompt;
  if (typeof source.slug === "string" && source.slug.trim()) {
    const slug = slugify(source.slug);
    if (SLUG_PATTERN.test(slug)) override.slug = slug;
  }
  if (typeof source.live === "boolean") override.live = source.live;
  if (source.passwordHash === null) override.passwordHash = null;
  else if (hashOrNull(source.passwordHash)) override.passwordHash = hashOrNull(source.passwordHash);
  const organizationId = organizationIdFrom(source.organizationId);
  if (organizationId !== undefined) override.organizationId = organizationId;
  if (source.slides === null) override.slides = null;
  else {
    const slides = sanitizeSlides(source.slides);
    if (slides) override.slides = slides;
  }
  return Object.keys(override).length ? override : null;
}

function sanitizeCustom(value: unknown): CustomPitch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as CustomPitch;
  if (typeof source.id !== "string" || !/^pitch_[a-z0-9]{4,24}$/.test(source.id)) return null;
  const name = clip(source.name, MAX_NAME);
  const prompt = clip(source.prompt, MAX_PROMPT);
  const slug = slugify(typeof source.slug === "string" ? source.slug : "");
  const slides = sanitizeSlides(source.slides);
  if (!name || !prompt || !slides) return null;
  return {
    id: source.id,
    slug,
    name,
    prompt,
    live: source.live !== false,
    passwordHash: hashOrNull(source.passwordHash),
    organizationId: organizationIdFrom(source.organizationId) ?? null,
    slides,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date(0).toISOString(),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date(0).toISOString(),
  };
}

export function normalizeWebPitches(raw: unknown): WebPitchesState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { overrides: {}, custom: [] };
  const source = raw as { overrides?: unknown; custom?: unknown };
  const overrides: Record<string, PitchOverride> = {};
  if (source.overrides && typeof source.overrides === "object" && !Array.isArray(source.overrides)) {
    for (const [id, value] of Object.entries(source.overrides)) {
      if (id !== SOBECA_PITCH_ID && id !== INITIAL_MEETING_ID && id !== STRATEGY_ID && id !== VISIT_BELLEVUE_ID) continue;
      const override = sanitizeOverride(value);
      if (override) overrides[id] = override;
    }
  }
  const custom = Array.isArray(source.custom)
    ? source.custom.map(sanitizeCustom).filter((pitch): pitch is CustomPitch => Boolean(pitch)).slice(0, MAX_CUSTOM)
    : [];
  const seen = new Set<string>();
  const unique = custom.filter((pitch) => {
    if (seen.has(pitch.id) || seen.has(pitch.slug)) return false;
    seen.add(pitch.id);
    seen.add(pitch.slug);
    return true;
  });
  return { overrides, custom: unique };
}

function storedSlug(state: WebPitchesState, id: string, fallback: string): string {
  const slug = state.overrides[id]?.slug;
  return slug && SLUG_PATTERN.test(slug) ? slug : fallback;
}

function takenSlugs(state: WebPitchesState, exceptId?: string): Set<string> {
  const taken = new Set<string>();
  if (exceptId !== SOBECA_PITCH_ID) {
    taken.add(SOBECA_PITCH_ID);
    taken.add(storedSlug(state, SOBECA_PITCH_ID, SOBECA_PITCH_ID));
  }
  if (exceptId !== INITIAL_MEETING_ID) {
    taken.add(INITIAL_MEETING_ID);
    taken.add(storedSlug(state, INITIAL_MEETING_ID, INITIAL_MEETING_ID));
  }
  if (exceptId !== STRATEGY_ID) {
    taken.add(STRATEGY_ID);
    taken.add(storedSlug(state, STRATEGY_ID, STRATEGY_ID));
  }
  if (exceptId !== VISIT_BELLEVUE_ID) {
    taken.add(VISIT_BELLEVUE_ID);
    taken.add(storedSlug(state, VISIT_BELLEVUE_ID, VISIT_BELLEVUE_ID));
  }
  for (const pitch of state.custom) {
    if (pitch.id !== exceptId) taken.add(pitch.slug);
  }
  return taken;
}

function presentCustom(pitch: CustomPitch): LoadedPitch {
  return {
    id: pitch.id,
    slug: pitch.slug,
    name: pitch.name,
    title: pitchTitle(pitch.slides, pitch.name),
    prompt: pitch.prompt,
    live: pitch.live,
    passwordHash: pitch.passwordHash,
    href: hrefForPitch(pitch.id, pitch.slug),
    builtin: false,
    organizationId: pitch.organizationId,
    slides: pitch.slides,
  };
}

export function listLoadedPitches(
  state: WebPitchesState,
  sobeca: { slides: PitchSlide[]; passwordHash: string | null }
): LoadedPitch[] {
  const sobecaOverride = state.overrides[SOBECA_PITCH_ID];
  const meetingOverride = state.overrides[INITIAL_MEETING_ID];
  const strategyOverride = state.overrides[STRATEGY_ID];
  const bellevueOverride = state.overrides[VISIT_BELLEVUE_ID];
  const meetingSlides =
    meetingOverride?.slides && meetingOverride.slides.length > 0
      ? cloneSlides(meetingOverride.slides)
      : cloneSlides(initialMeetingSlides);
  const strategyDeck =
    strategyOverride?.slides && strategyOverride.slides.length > 0
      ? cloneSlides(strategyOverride.slides)
      : cloneSlides(strategySlides);
  const sobecaSlug = storedSlug(state, SOBECA_PITCH_ID, SOBECA_PITCH_ID);
  const meetingSlug = storedSlug(state, INITIAL_MEETING_ID, INITIAL_MEETING_ID);
  const strategySlug = storedSlug(state, STRATEGY_ID, STRATEGY_ID);
  const bellevueSlug = storedSlug(state, VISIT_BELLEVUE_ID, VISIT_BELLEVUE_ID);
  const bellevueDeck =
    bellevueOverride?.slides && bellevueOverride.slides.length > 0
      ? cloneSlides(bellevueOverride.slides)
      : cloneSlides(visitBellevueSlides);
  const sobecaPitch: LoadedPitch = {
    id: SOBECA_PITCH_ID,
    slug: sobecaSlug,
    name: sobecaOverride?.name || "SoBECA Song Garden",
    title: pitchTitle(sobeca.slides, "SoBECA Song Garden"),
    prompt: sobecaOverride?.prompt || SOBECA_PITCH_PROMPT,
    live: sobecaOverride?.live !== false,
    passwordHash: sobeca.passwordHash,
    href: hrefForPitch(SOBECA_PITCH_ID, sobecaSlug),
    builtin: true,
    organizationId: organizationIdFrom(sobecaOverride?.organizationId) ?? null,
    slides: sobeca.slides,
  };
  const meeting: LoadedPitch = {
    id: INITIAL_MEETING_ID,
    slug: meetingSlug,
    name: meetingOverride?.name || INITIAL_MEETING_NAME,
    title: pitchTitle(meetingSlides, INITIAL_MEETING_NAME),
    prompt: meetingOverride?.prompt || INITIAL_MEETING_PROMPT,
    live: meetingOverride?.live !== false,
    passwordHash: hashOrNull(meetingOverride?.passwordHash) ,
    href: hrefForPitch(INITIAL_MEETING_ID, meetingSlug),
    builtin: true,
    organizationId: organizationIdFrom(meetingOverride?.organizationId) ?? null,
    slides: meetingSlides,
  };
  const strategy: LoadedPitch = {
    id: STRATEGY_ID,
    slug: strategySlug,
    name: strategyOverride?.name || STRATEGY_NAME,
    title: pitchTitle(strategyDeck, STRATEGY_NAME),
    prompt: strategyOverride?.prompt || STRATEGY_PROMPT,
    live: strategyOverride?.live !== false,
    passwordHash: hashOrNull(strategyOverride?.passwordHash),
    href: hrefForPitch(STRATEGY_ID, strategySlug),
    builtin: true,
    organizationId: organizationIdFrom(strategyOverride?.organizationId) ?? null,
    slides: strategyDeck,
  };
  const bellevue: LoadedPitch = {
    id: VISIT_BELLEVUE_ID,
    slug: bellevueSlug,
    name: bellevueOverride?.name || VISIT_BELLEVUE_NAME,
    title: pitchTitle(bellevueDeck, VISIT_BELLEVUE_NAME),
    prompt: bellevueOverride?.prompt || VISIT_BELLEVUE_PROMPT,
    live: bellevueOverride?.live !== false,
    passwordHash: hashOrNull(bellevueOverride?.passwordHash),
    href: hrefForPitch(VISIT_BELLEVUE_ID, bellevueSlug),
    builtin: true,
    organizationId: organizationIdFrom(bellevueOverride?.organizationId) ?? null,
    slides: bellevueDeck,
  };
  const custom = [...state.custom].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(presentCustom);
  return [sobecaPitch, meeting, strategy, bellevue, ...custom];
}

export function findLoadedPitch(
  state: WebPitchesState,
  idOrSlug: string,
  sobeca: { slides: PitchSlide[]; passwordHash: string | null }
): LoadedPitch | null {
  return listLoadedPitches(state, sobeca).find((pitch) => pitch.id === idOrSlug || pitch.slug === idOrSlug) ?? null;
}

function requireText(value: string, label: string, max: number): string | { error: string } {
  const text = value.trim();
  if (!text) return { error: `${label} is required.` };
  if (text.length > max) return { error: `Keep the ${label.toLowerCase()} under ${max} characters.` };
  return text;
}

export function createCustomPitch(
  state: WebPitchesState,
  input: { name: string; prompt: string; live: boolean; passwordHash: string | null; organizationId?: string | null },
  deps: { id: string; now: string }
): { state: WebPitchesState; pitch: CustomPitch } | { error: string } {
  if (state.custom.length >= MAX_CUSTOM) return { error: "The pitch library is full." };
  const name = requireText(input.name, "Name", MAX_NAME);
  if (typeof name !== "string") return name;
  const prompt = requireText(input.prompt, "Prompt", MAX_PROMPT);
  if (typeof prompt !== "string") return prompt;
  let organizationId: string | null = null;
  if (input.organizationId) {
    const parsed = organizationIdFrom(input.organizationId);
    if (!parsed) return { error: "Choose an organization from search." };
    organizationId = parsed;
  }
  const slug = uniqueSlug(slugify(name), takenSlugs(state));
  const pitch: CustomPitch = {
    id: deps.id,
    slug,
    name,
    prompt,
    live: input.live,
    passwordHash: input.passwordHash,
    organizationId,
    slides: seedSlides(name, prompt),
    createdAt: deps.now,
    updatedAt: deps.now,
  };
  return { state: { ...state, custom: [pitch, ...state.custom] }, pitch };
}

export function duplicatePitch(
  state: WebPitchesState,
  source: LoadedPitch,
  deps: { id: string; now: string }
): { state: WebPitchesState; pitch: CustomPitch } | { error: string } {
  if (state.custom.length >= MAX_CUSTOM) return { error: "The pitch library is full." };
  const name = `Copy of ${source.name}`.slice(0, MAX_NAME);
  const slug = uniqueSlug(slugify(name), takenSlugs(state));
  const pitch: CustomPitch = {
    id: deps.id,
    slug,
    name,
    prompt: source.prompt,
    live: source.live,
    passwordHash: source.passwordHash,
    organizationId: source.organizationId,
    slides: cloneSlides(source.slides),
    createdAt: deps.now,
    updatedAt: deps.now,
  };
  return { state: { ...state, custom: [pitch, ...state.custom] }, pitch };
}

export function applyPitchPatch(
  state: WebPitchesState,
  current: LoadedPitch,
  patch: {
    name?: string;
    prompt?: string;
    slug?: string;
    live?: boolean;
    slides?: unknown;
    reset?: boolean;
    organizationId?: string | null;
  },
  now: string
): { state: WebPitchesState; pitch: LoadedPitch } | { error: string } {
  let name = current.name;
  let prompt = current.prompt;
  let slug = current.slug;
  if (typeof patch.slug === "string") {
    const parsed = parsePitchUrl(patch.slug, current.id);
    if ("error" in parsed) return parsed;
    if (takenSlugs(state, current.id).has(parsed.slug)) return { error: "That address is already in use." };
    slug = parsed.slug;
  }
  if (typeof patch.name === "string") {
    const next = requireText(patch.name, "Name", MAX_NAME);
    if (typeof next !== "string") return next;
    name = next;
  }
  if (typeof patch.prompt === "string") {
    const next = requireText(patch.prompt, "Prompt", MAX_PROMPT);
    if (typeof next !== "string") return next;
    prompt = next;
  }
  const live = typeof patch.live === "boolean" ? patch.live : current.live;
  let organizationId = current.organizationId;
  if (patch.organizationId !== undefined) {
    if (patch.organizationId === null) organizationId = null;
    else {
      const parsed = organizationIdFrom(patch.organizationId);
      if (!parsed) return { error: "Choose an organization from search." };
      organizationId = parsed;
    }
  }
  let slides = current.slides;
  if (patch.reset) {
    slides =
      current.id === INITIAL_MEETING_ID
        ? cloneSlides(initialMeetingSlides)
        : current.id === STRATEGY_ID
          ? cloneSlides(strategySlides)
          : current.id === VISIT_BELLEVUE_ID
            ? cloneSlides(visitBellevueSlides)
            : current.builtin
            ? current.slides
            : seedSlides(name, prompt);
    if (current.id === SOBECA_PITCH_ID) slides = current.slides;
  } else if (patch.slides !== undefined) {
    if (current.id === SOBECA_PITCH_ID) {
      slides = current.slides;
    } else if (Array.isArray(patch.slides) && patch.slides.length === 0) {
      return { error: "A pitch needs at least one slide." };
    } else {
      const accepted = acceptSlides(patch.slides);
      if (!accepted) {
        return { error: "Each slide needs a photo and at least one block, with no duplicate ids." };
      }
      slides = accepted;
    }
  }

  const nextPitch: LoadedPitch = {
    ...current,
    name,
    prompt,
    slug,
    href: hrefForPitch(current.id, slug),
    live,
    organizationId,
    slides,
    title: pitchTitle(slides, name),
  };

  if (!current.builtin) {
    const custom = state.custom.map((pitch) =>
      pitch.id === current.id
        ? {
            ...pitch,
            name,
            prompt,
            slug,
            live,
            organizationId,
            slides,
            updatedAt: now,
          }
        : pitch
    );
    return { state: { ...state, custom }, pitch: nextPitch };
  }

  const previous = state.overrides[current.id] ?? {};
  const override: PitchOverride = { ...previous, name, prompt, slug, live, organizationId };
  if (current.id === INITIAL_MEETING_ID || current.id === STRATEGY_ID || current.id === VISIT_BELLEVUE_ID) {
    if (patch.reset) override.slides = null;
    else if (patch.slides !== undefined) override.slides = slides;
  }
  return {
    state: { ...state, overrides: { ...state.overrides, [current.id]: override } },
    pitch: nextPitch,
  };
}

export function applyPassword(
  state: WebPitchesState,
  current: LoadedPitch,
  passwordHash: string | null
): { state: WebPitchesState; pitch: LoadedPitch } {
  const pitch = { ...current, passwordHash };
  if (!current.builtin) {
    return {
      pitch,
      state: {
        ...state,
        custom: state.custom.map((item) => (item.id === current.id ? { ...item, passwordHash } : item)),
      },
    };
  }
  if (current.id === SOBECA_PITCH_ID) return { state, pitch };
  const previous = state.overrides[current.id] ?? {};
  return {
    pitch,
    state: {
      ...state,
      overrides: { ...state.overrides, [current.id]: { ...previous, passwordHash } },
    },
  };
}
