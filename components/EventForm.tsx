"use client";

import { useState, FormEvent, useEffect } from "react";
import AddressMap from "./AddressMap";
import { getAgentThemes } from "@/data/agentInterview";
import type { AgentTheme } from "@/data/agentInterview";
import type { AgentBrief } from "@/data/agentInterview";
import {
  DEFAULT_SONG_GARDEN_CONFIG,
  normalizeSongGardenConfig,
  type SongGardenConfig,
} from "@/data/songGarden";

export type EventFormValues = {
  experienceMode: "agent" | "songGarden";
  title: string;
  slug: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  prompt: string;
  heroImage: string;
  heroImageMode: "bw" | "color";
  landingHeadline: string;
  landingCopy: string;
  ctaText: string;
  agentThemeId: string | null;
  agentBrief: AgentBrief | null;
};

type EventFormProps = {
  onSubmit: (values: EventFormValues) => Promise<void> | void;
  initialValues?: Partial<EventFormValues>;
  submitLabel?: string;
  /** Shown after a successful submit (e.g. before redirect). */
  submitSuccessMessage?: string;
};

const initialValues: EventFormValues = {
  experienceMode: "agent",
  title: "",
  slug: "",
  description: "",
  date: "",
  time: "",
  venue: "",
  address: "",
  // Used only for the "no agent" public event view.
  // The agent interview is the default, so this is safe as a hidden default.
  prompt: "Let's do it.",
  heroImage: "",
  heroImageMode: "bw",
  landingHeadline: "We're crowdsourcing a song for this event. Want to help create it?",
  landingCopy: "",
  ctaText: "Let's make an anthem",
  agentThemeId: null,
  agentBrief: null,
};

const MONTH_ABBREV = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const TEMPLATE_DEFAULTS: Record<
  "birthday" | "fundraiser" | "other",
  {
    eventType: string;
    emotionalArc: string;
    askAboutItems: Array<{
      prompt: string;
      allowAudio?: boolean;
      allowVideo?: boolean;
      requireEmailCaptcha?: boolean;
    }>;
  }
> = {
  birthday: {
    eventType: "birthday",
    emotionalArc: "fun -> heartfelt -> celebratory",
    askAboutItems: [
      { prompt: "In one word, how would you describe [person]?" },
      { prompt: "What's one thing you love or admire about [person]?" },
      { prompt: "What's a funny or \"classic [person]\" moment you've witnessed?" },
      { prompt: "What is [person]'s superpower?" },
      { prompt: "What do you wish for [person] in the next 50 years?" },
      { prompt: "Finish this line: \"[person], you are...\"" },
      { prompt: "What else would you like to say about [person]?", allowAudio: true, allowVideo: true },
      { prompt: "What email should we send your anthem to?", requireEmailCaptcha: true },
    ],
  },
  fundraiser: {
    eventType: "fundraiser",
    emotionalArc: "gratitude -> impact -> hope",
    askAboutItems: [
      { prompt: "Why this cause matters to you" },
      { prompt: "A moment of impact you've seen" },
      { prompt: "What support you hope to inspire" },
      { prompt: "What email should we send your anthem to?", requireEmailCaptcha: true },
    ],
  },
  other: {
    eventType: "other",
    emotionalArc: "engaging -> reflective -> inspiring",
    askAboutItems: [
      { prompt: "How you're connected to this event" },
      { prompt: "A standout moment or insight" },
      { prompt: "What message you'd like to share" },
      { prompt: "What email should we send your anthem to?", requireEmailCaptcha: true },
    ],
  },
};
const SAVED_AGENT_TEMPLATES_KEY = "csc_agent_saved_templates_v1";

type SavedAgentTemplate = {
  id: string;
  name: string;
  eventType: "birthday" | "fundraiser" | "other" | string;
  whoWhat?: string;
  emotionalArc?: string;
  askAboutItems: Array<{
    prompt: string;
    allowAudio?: boolean;
    allowVideo?: boolean;
    requireEmailCaptcha?: boolean;
  }>;
};

function formatDateForSlug(dateStr: string): string {
  if (!dateStr) return "";
  // Parse as local date (YYYY-MM-DD) so slug matches calendar day; avoid UTC midnight shifting to previous day
  const parts = dateStr.split("-").map(Number);
  const [, month1, day] = parts;
  if (!month1 || !day || month1 < 1 || month1 > 12) return "";
  const month = MONTH_ABBREV[month1 - 1];
  return `csc-${month}${day}`;
}

export default function EventForm({
  onSubmit,
  initialValues: initialProp,
  submitLabel = "Create Event",
  submitSuccessMessage = "Event created.",
}: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>({ ...initialValues, ...initialProp });
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [themes, setThemes] = useState<AgentTheme[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedAgentTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    getAgentThemes().then(setThemes).catch(() => setThemes([]));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SAVED_AGENT_TEMPLATES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedTemplates(
          parsed.filter((t) => t && typeof t.name === "string" && Array.isArray(t.askAboutItems))
        );
      }
    } catch {
      setSavedTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (values.agentThemeId || themes.length === 0) return;
    const preferred =
      themes.find((t) => t.key === "conference") ??
      themes.find((t) => t.key === "birthday") ??
      themes.find((t) => t.key === "fundraiser") ??
      themes[0];
    if (!preferred) return;
    setValues((v) => ({ ...v, agentThemeId: preferred.id }));
  }, [themes, values.agentThemeId]);

  useEffect(() => {
    if (values.agentBrief) return;
    const d = TEMPLATE_DEFAULTS.other;
    setValues((v) => ({
      ...v,
      agentBrief: {
        ...(v.agentBrief ?? {}),
        eventType: d.eventType,
        emotionalArc: d.emotionalArc,
        askAboutItems: d.askAboutItems,
        askAbout: d.askAboutItems.map((q) => q.prompt),
      },
    }));
    // Intentionally run once to ensure fields are editable immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const brief = values.agentBrief;
    if (!brief) return;
    if (Array.isArray(brief.askAboutItems) && brief.askAboutItems.length > 0) return;
    const fromAskAbout = Array.isArray(brief.askAbout)
      ? brief.askAbout
          .map((prompt) => (typeof prompt === "string" ? prompt.trim() : ""))
          .filter((prompt): prompt is string => prompt.length > 0)
          .map((prompt) => ({ prompt, allowAudio: false, allowVideo: false, requireEmailCaptcha: false }))
      : [];
    if (fromAskAbout.length === 0) return;
    setValues((v) => ({
      ...v,
      agentBrief: {
        ...(v.agentBrief ?? {}),
        askAboutItems: fromAskAbout,
      },
    }));
  }, [values.agentBrief]);

  useEffect(() => {
    if (slugManuallyEdited || !values.date) return;
    setValues((v) => ({ ...v, slug: formatDateForSlug(values.date) }));
  }, [values.date, slugManuallyEdited]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const normalizedAskAboutItems =
      values.experienceMode === "songGarden"
        ? []
        : (values.agentBrief?.askAboutItems ?? [])
            .map((item) => ({
              prompt: item.prompt.trim(),
              allowAudio: !!item.allowAudio,
              allowVideo: !!item.allowVideo,
              requireEmailCaptcha: !!item.requireEmailCaptcha,
            }))
            .filter((item) => item.prompt.length > 0);
    const activeSongGarden =
      values.experienceMode === "songGarden"
        ? normalizeSongGardenConfig(values.agentBrief?.songGarden) ?? DEFAULT_SONG_GARDEN_CONFIG
        : null;
    const brief =
      values.experienceMode === "songGarden"
        ? {
            eventType: "song_garden",
            whoWhat: values.agentBrief?.whoWhat,
            emotionalArc: values.agentBrief?.emotionalArc,
            askAboutItems: [],
            askAbout: [],
            songGarden: activeSongGarden,
          }
        : values.agentBrief
        ? {
            eventType: values.agentBrief.eventType,
            whoWhat: values.agentBrief.whoWhat,
            emotionalArc: values.agentBrief.emotionalArc,
            askAboutItems: normalizedAskAboutItems,
            askAbout: normalizedAskAboutItems.map((item) => item.prompt),
            songGarden: null,
          }
        : null;
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...values,
        agentThemeId: values.experienceMode === "songGarden" ? null : values.agentThemeId,
        agentBrief: brief,
      });
      setSuccess(true);
    } catch (err) {
      setSuccess(false);
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function setBrief<K extends keyof AgentBrief>(key: K, value: AgentBrief[K]) {
    setValues((v) => ({
      ...v,
      agentBrief: { ...(v.agentBrief ?? {}), [key]: value } as AgentBrief,
    }));
  }

  function setSongGarden<K extends keyof SongGardenConfig>(key: K, value: SongGardenConfig[K]) {
    setValues((v) => {
      const current = normalizeSongGardenConfig(v.agentBrief?.songGarden) ?? DEFAULT_SONG_GARDEN_CONFIG;
      return {
        ...v,
        experienceMode: "songGarden",
        agentThemeId: null,
        agentBrief: {
          ...(v.agentBrief ?? {}),
          eventType: "song_garden",
          songGarden: { ...current, [key]: value },
        } as AgentBrief,
      };
    });
  }

  function persistSavedTemplates(next: SavedAgentTemplate[]) {
    setSavedTemplates(next);
    if (typeof window === "undefined") return;
    localStorage.setItem(SAVED_AGENT_TEMPLATES_KEY, JSON.stringify(next));
  }

  function applySavedTemplate(tpl: SavedAgentTemplate) {
    const matchedTheme =
      themes.find((t) => t.key === tpl.eventType) ??
      (tpl.eventType === "other" ? themes.find((t) => t.key === "conference") : undefined) ??
      null;
    setValues((v) => ({
      ...v,
      agentThemeId: matchedTheme?.id ?? v.agentThemeId ?? null,
      agentBrief: {
        ...(v.agentBrief ?? {}),
        eventType: tpl.eventType,
        whoWhat: tpl.whoWhat,
        emotionalArc: tpl.emotionalArc,
        askAboutItems: tpl.askAboutItems,
        askAbout: tpl.askAboutItems.map((item) => item.prompt),
      },
    }));
    setCustomMode(true);
  }

  function saveCurrentAsTemplate() {
    const trimmed = templateName.trim();
    if (!trimmed) {
      setThemeError("Add a template name before saving.");
      return;
    }
    const askAboutItems = (values.agentBrief?.askAboutItems ?? [])
      .map((x) => ({
        prompt: x.prompt.trim(),
        allowAudio: !!x.allowAudio,
        allowVideo: !!x.allowVideo,
        requireEmailCaptcha: !!x.requireEmailCaptcha,
      }))
      .filter((x) => x.prompt.length > 0);
    if (askAboutItems.length === 0) {
      setThemeError("Add at least one question topic before saving a template.");
      return;
    }
    const eventTypeRaw = (values.agentBrief?.eventType ?? "other").toLowerCase();
    const normalizedType: SavedAgentTemplate["eventType"] =
      eventTypeRaw === "birthday" || eventTypeRaw === "fundraiser" || eventTypeRaw === "other"
        ? eventTypeRaw
        : "other";
    const tpl: SavedAgentTemplate = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      eventType: normalizedType,
      whoWhat: values.agentBrief?.whoWhat,
      emotionalArc: values.agentBrief?.emotionalArc,
      askAboutItems,
    };
    persistSavedTemplates([tpl, ...savedTemplates]);
    setTemplateName("");
    setThemeError(null);
  }

  function handleSlugChange(next: string) {
    setSlugManuallyEdited(true);
    setValues((v) => ({ ...v, slug: next }));
  }

  function handleHeroFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setValues((v) => ({ ...v, heroImage: reader.result as string }));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const inputClass =
    "mt-1 block w-full rounded-xl border border-gray-700/60 bg-[#2a2a2a] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600";
  const labelClass = "block text-sm font-semibold text-gray-300";
  const activeSongGarden = normalizeSongGardenConfig(values.agentBrief?.songGarden) ?? DEFAULT_SONG_GARDEN_CONFIG;

  return (
    <form noValidate onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-6">
      {submitError && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {submitError}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-800/60 bg-green-900/20 px-4 py-3 text-sm text-green-300">
          {submitSuccessMessage}
        </div>
      )}
      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          type="text"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="slug" className={labelClass}>
          Public URL
        </label>
        <div className="mt-1 flex overflow-hidden rounded-xl border border-gray-700/60 bg-[#2a2a2a]">
          <span className="flex items-center border-r border-gray-700/60 bg-[#1f1f1f] px-4 py-3 text-sm text-gray-500">
            /e/
          </span>
          <input
            id="slug"
            type="text"
            placeholder="csc-mar1 (auto from date)"
            value={values.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-0"
          />
        </div>
      </div>
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={labelClass}>
            Date
          </label>
          <input
            id="date"
            type="date"
            value={values.date}
            onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
        <div>
          <label htmlFor="time" className={labelClass}>
            Time
          </label>
          <input
            id="time"
            type="time"
            value={values.time}
            onChange={(e) => setValues((v) => ({ ...v, time: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="venue" className={labelClass}>
          Venue
        </label>
        <input
          id="venue"
          type="text"
          value={values.venue}
          onChange={(e) => setValues((v) => ({ ...v, venue: e.target.value }))}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="address" className={labelClass}>
          Address
        </label>
        <input
          id="address"
          type="text"
          value={values.address}
          onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
          className={inputClass}
        />
        <AddressMap venue={values.venue} address={values.address} className="mt-2" />
      </div>
      <div>
        <label htmlFor="heroImage" className={labelClass}>
          Hero image
        </label>
        <p className="mt-0.5 text-xs text-gray-500">Paste a URL or upload an image.</p>
        <input
          id="heroImage"
          type="text"
          placeholder="https://…"
          value={values.heroImage}
          onChange={(e) => setValues((v) => ({ ...v, heroImage: e.target.value }))}
          className={inputClass}
        />
        <div className="mt-2 flex items-center gap-3">
          <label className="cursor-pointer rounded-xl border border-gray-600 bg-[#2a2a2a] px-4 py-3 text-sm font-medium text-gray-400 hover:bg-[#333] hover:text-gray-300">
            Upload image
            <input
              type="file"
              accept="image/*"
              onChange={handleHeroFile}
              className="hidden"
            />
          </label>
          {values.heroImage && (
            <div className="h-16 w-24 overflow-hidden rounded-xl border border-gray-700 bg-[#1f1f1f]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={values.heroImage}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
      <section className="rounded-2xl border border-gray-700/60 bg-[#1f1f1f] p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Public Landing Page</h3>
        <p className="mt-1 text-xs text-gray-500">Customize the opening copy and CTA for this event.</p>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="landingHeadline" className={labelClass}>
              Landing headline
            </label>
            <input
              id="landingHeadline"
              type="text"
              value={values.landingHeadline}
              onChange={(e) => setValues((v) => ({ ...v, landingHeadline: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="landingCopy" className={labelClass}>
              Supporting copy
            </label>
            <textarea
              id="landingCopy"
              rows={2}
              value={values.landingCopy}
              onChange={(e) => setValues((v) => ({ ...v, landingCopy: e.target.value }))}
              className={inputClass}
              placeholder="Optional short subheading under the headline."
            />
          </div>
          <div>
            <label htmlFor="ctaText" className={labelClass}>
              CTA button text
            </label>
            <input
              id="ctaText"
              type="text"
              value={values.ctaText}
              onChange={(e) => setValues((v) => ({ ...v, ctaText: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="heroImageMode" className={labelClass}>
                Default photo mode
              </label>
              <select
                id="heroImageMode"
                value={values.heroImageMode}
                onChange={(e) =>
                  setValues((v) => ({ ...v, heroImageMode: e.target.value === "color" ? "color" : "bw" }))
                }
                className={inputClass}
              >
                <option value="bw">Black and white</option>
                <option value="color">Full color</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700/60 bg-[#1f1f1f] p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Experience Mode</h3>
        <p className="mt-1 text-xs text-gray-500">
          Choose the current lyric interview flow or the new audio-first Song Garden flow.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              id: "agent" as const,
              title: "Crowdsource Choir",
              copy: "Collect stories, memories, language, and lyric inspiration.",
            },
            {
              id: "songGarden" as const,
              title: "Song Garden",
              copy: "Collect vowels, breaths, rhythms, phrases, and lyric seeds as performance assets.",
            },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                if (mode.id === "songGarden") {
                  setValues((v) => ({
                    ...v,
                    experienceMode: "songGarden",
                    agentThemeId: null,
                    landingHeadline:
                      !v.landingHeadline ||
                      v.landingHeadline === "We're crowdsourcing a song for this event. Want to help create it?"
                        ? "Add your voice to the Song Garden."
                        : v.landingHeadline,
                    landingCopy:
                      v.landingCopy ||
                      "Record a short guided sound. Each voice helps grow the shared instrument for this event.",
                    ctaText: !v.ctaText || v.ctaText === "Let's make an anthem" ? "Enter the Song Garden" : v.ctaText,
                    agentBrief: {
                      ...(v.agentBrief ?? {}),
                      eventType: "song_garden",
                      songGarden: normalizeSongGardenConfig(v.agentBrief?.songGarden) ?? DEFAULT_SONG_GARDEN_CONFIG,
                    },
                  }));
                } else {
                  setValues((v) => ({
                    ...v,
                    experienceMode: "agent",
                    agentBrief: {
                      ...(v.agentBrief ?? {}),
                      songGarden: null,
                    },
                  }));
                }
              }}
              className={`rounded-xl border px-4 py-4 text-left transition ${
                values.experienceMode === mode.id
                  ? "border-amber-300/70 bg-amber-300/10 text-white"
                  : "border-gray-700 bg-[#18181b] text-gray-300 hover:border-gray-500"
              }`}
            >
              <span className="block text-sm font-semibold">{mode.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-400">{mode.copy}</span>
            </button>
          ))}
        </div>
      </section>

      {values.experienceMode === "songGarden" && (
        <section className="rounded-2xl border border-amber-300/25 bg-[#1f1f1f] p-4 sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">Song Garden V1</h3>
          <p className="mt-1 text-xs text-gray-500">
            V1 exports approved recordings into Ableton/MPC-ready folders with a manifest, lyric text, and simple MIDI.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="songGardenBpm" className={labelClass}>
                Export BPM
              </label>
              <input
                id="songGardenBpm"
                type="number"
                min={60}
                max={180}
                value={activeSongGarden.exportBpm}
                onChange={(e) => setSongGarden("exportBpm", Number(e.target.value) || 96)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="songGardenChords" className={labelClass}>
                Chord progression
              </label>
              <input
                id="songGardenChords"
                type="text"
                value={activeSongGarden.chordProgression.join(" - ")}
                onChange={(e) =>
                  setSongGarden(
                    "chordProgression",
                    e.target.value
                      .split(/[-,]/)
                      .map((x) => x.trim())
                      .filter(Boolean)
                  )
                }
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="songGardenConsent" className={labelClass}>
              Consent copy
            </label>
            <textarea
              id="songGardenConsent"
              rows={2}
              value={activeSongGarden.consentCopy}
              onChange={(e) => setSongGarden("consentCopy", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="mt-4 rounded-xl border border-gray-700/60 bg-[#18181b] p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Prompt pack</p>
            <ul className="space-y-2">
              {activeSongGarden.prompts.map((prompt) => (
                <li key={prompt.id} className="rounded-lg border border-gray-700/60 bg-[#1f1f1f] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-200">{prompt.title}</span>
                    <span className="rounded-full bg-gray-800 px-2 py-1 text-[11px] uppercase tracking-wide text-gray-400">
                      {prompt.assetCategory.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{prompt.instruction}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {values.experienceMode === "agent" && (
      <section className="rounded-2xl border border-gray-700/60 bg-[#1f1f1f] p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Agent Interview</h3>
        <p className="mt-1 text-xs text-gray-500">Required. This always powers the public event experience.</p>
        <div className="mt-4 space-y-4">
          <div className="space-y-3">
            <label className={labelClass}>Template</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "birthday", label: "Birthday", themeKey: "birthday" },
                  { id: "fundraiser", label: "Fundraiser", themeKey: "fundraiser" },
                  { id: "other", label: "Other", themeKey: "conference" },
                ] as const
              ).map((opt) => {
                const selectedTemplate = (values.agentBrief?.eventType ?? "").toLowerCase();
                const active =
                  selectedTemplate === opt.id ||
                  themes.find((t) => t.id === values.agentThemeId)?.key === opt.themeKey;
                const themeForOpt = themes.find((t) => t.key === (opt.themeKey ?? ""));
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={async () => {
                      // If themes haven't finished loading yet, re-fetch them once so
                      // template clicks still work reliably.
                      let theme: AgentTheme | null = themeForOpt ?? null;
                      if (!theme) {
                        try {
                          const fresh = await getAgentThemes();
                          setThemes(fresh);
                          theme = fresh.find((t) => t.key === (opt.themeKey ?? "")) ?? null;
                        } catch {
                          theme = null;
                        }
                      }
                      setThemeError(null);
                      const local = TEMPLATE_DEFAULTS[opt.id];

                      setValues((v) => {
                        const prevBrief = v.agentBrief ?? null;
                        const nextAskAboutItems = local.askAboutItems;
                        const nextEmotionalArc = local.emotionalArc;

                        return {
                          ...v,
                          agentThemeId: theme?.id ?? v.agentThemeId ?? null,
                          agentBrief: {
                            ...(prevBrief ?? {}),
                            eventType: local.eventType,
                            // Always preload template defaults when template is clicked.
                            askAboutItems: nextAskAboutItems,
                            askAbout: nextAskAboutItems.map((item) => item.prompt),
                            emotionalArc: nextEmotionalArc,
                          },
                        };
                      });
                    }}
                    className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-gray-800 text-white"
                        : "border border-gray-700 bg-[#1f1f1f] text-gray-400 hover:text-gray-200"
                    } ${!themeForOpt ? "opacity-80" : ""}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {themeError && <p className="text-xs text-amber-300">{themeError}</p>}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-700/60 bg-[#18181b] px-3 py-3">
              <div>
                <div className="text-sm font-semibold text-white">Custom Mode</div>
                <div className="text-xs text-gray-400">
                  Disable template auto-load and build your question topics freely.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomMode((v) => !v)}
                className={`min-h-[44px] min-w-[120px] rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  customMode ? "bg-white text-gray-900" : "bg-gray-800 text-gray-200 hover:bg-gray-700"
                }`}
              >
                {customMode ? "On" : "Off"}
              </button>
            </div>

            <div className="rounded-xl border border-gray-700/60 bg-[#18181b] p-3">
              <label htmlFor="saveTemplateName" className={labelClass}>
                Save this as a template
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="saveTemplateName"
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. Team appreciation)"
                  className="min-h-[44px] flex-1 rounded-xl border border-gray-700 bg-[#1f1f1f] px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveCurrentAsTemplate}
                  className="min-h-[44px] rounded-xl border border-gray-600 bg-[#222] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-[#2a2a2a]"
                >
                  Save template
                </button>
              </div>
              {savedTemplates.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Saved templates</p>
                  <div className="flex flex-wrap gap-2">
                    {savedTemplates.map((tpl) => (
                      <div key={tpl.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => applySavedTemplate(tpl)}
                          className="min-h-[40px] rounded-lg border border-gray-700 bg-[#1f1f1f] px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-[#2a2a2a]"
                          title={`Load "${tpl.name}"`}
                        >
                          {tpl.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => persistSavedTemplates(savedTemplates.filter((x) => x.id !== tpl.id))}
                          className="min-h-[40px] rounded-lg border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/30"
                          title={`Delete "${tpl.name}"`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {
            <>
              <div>
                <label htmlFor="briefWhoWhat" className={labelClass}>
                  Who / what it&apos;s for
                </label>
                <input
                  id="briefWhoWhat"
                  type="text"
                  placeholder="e.g. honoree name, org name, mission"
                  value={values.agentBrief?.whoWhat ?? ""}
                  onChange={(e) => setBrief("whoWhat", e.target.value || undefined)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="briefEmotionalArc" className={labelClass}>
                  Emotional arc
                </label>
                <input
                  id="briefEmotionalArc"
                  type="text"
                  placeholder="e.g. fun → heartfelt → celebratory"
                  value={values.agentBrief?.emotionalArc ?? ""}
                  onChange={(e) => setBrief("emotionalArc", e.target.value || undefined)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="briefAskAbout" className={labelClass}>
                  Question topics (in order)
                </label>
                <p className="mt-0.5 text-xs text-gray-500">Editable list. Reorder with ↑/↓. One topic per item.</p>

                <div className="mt-3 space-y-3">
                  {(values.agentBrief?.askAboutItems ?? []).map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-gray-700/60 bg-[#18181b] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-gray-400">#{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const next = [...(values.agentBrief?.askAboutItems ?? [])];
                              const tmp = next[idx - 1];
                              next[idx - 1] = next[idx];
                              next[idx] = tmp;
                              setBrief("askAboutItems", next);
                              setBrief("askAbout", next.map((x) => x.prompt));
                            }}
                            className="rounded-lg border border-gray-700 bg-[#1f1f1f] px-2 py-1 text-xs font-semibold text-gray-300 disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === (values.agentBrief?.askAboutItems ?? []).length - 1}
                            onClick={() => {
                              const next = [...(values.agentBrief?.askAboutItems ?? [])];
                              const tmp = next[idx + 1];
                              next[idx + 1] = next[idx];
                              next[idx] = tmp;
                              setBrief("askAboutItems", next);
                              setBrief("askAbout", next.map((x) => x.prompt));
                            }}
                            className="rounded-lg border border-gray-700 bg-[#1f1f1f] px-2 py-1 text-xs font-semibold text-gray-300 disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(values.agentBrief?.askAboutItems ?? [])].filter((_, i) => i !== idx);
                              setBrief("askAboutItems", next);
                              setBrief("askAbout", next.map((x) => x.prompt));
                            }}
                            className="rounded-lg border border-red-800/60 bg-red-950/30 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-900/30"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(values.agentBrief?.askAboutItems ?? [])];
                              next[idx] = { ...next[idx], allowAudio: !next[idx]?.allowAudio };
                              setBrief("askAboutItems", next);
                              setBrief("askAbout", next.map((x) => x.prompt));
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                              item.allowAudio
                                ? "border border-blue-600/70 bg-blue-900/30 text-blue-200"
                                : "border border-gray-700 bg-[#1f1f1f] text-gray-300"
                            }`}
                          >
                            {item.allowAudio ? "Audio: On" : "Audio: Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(values.agentBrief?.askAboutItems ?? [])];
                              next[idx] = { ...next[idx], allowVideo: !next[idx]?.allowVideo };
                              setBrief("askAboutItems", next);
                              setBrief("askAbout", next.map((x) => x.prompt));
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                              item.allowVideo
                                ? "border border-purple-600/70 bg-purple-900/30 text-purple-200"
                                : "border border-gray-700 bg-[#1f1f1f] text-gray-300"
                            }`}
                          >
                            {item.allowVideo ? "Video: On" : "Video: Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(values.agentBrief?.askAboutItems ?? [])];
                              next[idx] = {
                                ...next[idx],
                                requireEmailCaptcha: !next[idx]?.requireEmailCaptcha,
                              };
                              setBrief("askAboutItems", next);
                              setBrief("askAbout", next.map((x) => x.prompt));
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                              item.requireEmailCaptcha
                                ? "border border-emerald-600/70 bg-emerald-900/30 text-emerald-200"
                                : "border border-gray-700 bg-[#1f1f1f] text-gray-300"
                            }`}
                          >
                            {item.requireEmailCaptcha ? "Email+Captcha: On" : "Email+Captcha: Off"}
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={item.prompt}
                        onChange={(e) => {
                          const next = [...(values.agentBrief?.askAboutItems ?? [])];
                          next[idx] = { ...next[idx], prompt: e.target.value };
                          setBrief("askAboutItems", next);
                          setBrief("askAbout", next.map((x) => x.prompt));
                        }}
                        className="mt-3 w-full rounded-xl border border-gray-600 bg-[#1f1f1f] px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                        placeholder="e.g. memories with the honoree"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const next = [...(values.agentBrief?.askAboutItems ?? [])];
                      next.push({
                        prompt: "",
                        allowAudio: false,
                        allowVideo: false,
                        requireEmailCaptcha: false,
                      });
                      setBrief("askAboutItems", next);
                      setBrief("askAbout", next.map((x) => x.prompt));
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-gray-700 bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-[#2a2a2a]"
                  >
                    + Add topic
                  </button>
                </div>
              </div>
            </>
          }
        </div>
      </section>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
