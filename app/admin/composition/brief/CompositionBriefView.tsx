"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  generateCompositionBrief,
  getCompositionBrief,
  type CompositionBrief,
} from "@/data/compositionClient";
import {
  briefDownloadFilename,
  briefToJson,
  briefToMarkdown,
} from "@/lib/composition/export-formats";

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-200"
    >
      {copied ? "Copied" : label ?? "Copy"}
    </button>
  );
}

function PhraseList({ items, numbered }: { items: string[]; numbered?: boolean }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">None yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 24)}`}
          className="flex items-start justify-between gap-3 rounded-lg border border-gray-700/60 bg-[#1f1f1f] px-3 py-2"
        >
          <span className="text-sm text-gray-200">
            {numbered ? `${i + 1}. ` : ""}
            {item}
          </span>
          <CopyButton text={item} />
        </li>
      ))}
    </ul>
  );
}

function BriefSections({ brief }: { brief: CompositionBrief }) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Creative Summary</h2>
          <CopyButton text={brief.creativeSummary} />
        </div>
        <p className="text-base leading-relaxed text-gray-200">{brief.creativeSummary || "—"}</p>
      </section>

      {brief.emotionalArc && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Emotional Arc</h2>
            <CopyButton text={brief.emotionalArc} />
          </div>
          <p className="text-sm leading-relaxed text-gray-300">{brief.emotionalArc}</p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Lyric Themes</h2>
        {brief.lyricThemes.length === 0 ? (
          <p className="text-sm text-gray-500">None yet.</p>
        ) : (
          <div className="space-y-4">
            {brief.lyricThemes.map((theme) => (
              <div key={theme.label} className="rounded-xl border border-gray-700/60 bg-[#1f1f1f] p-4">
                <p className="font-medium text-white">{theme.label}</p>
                <ul className="mt-2 space-y-1">
                  {theme.exampleLines.map((line) => (
                    <li key={line} className="flex items-start justify-between gap-3 text-sm text-gray-300">
                      <span>{line}</span>
                      <CopyButton text={line} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Strongest Phrases</h2>
        <PhraseList items={brief.strongestPhrases} numbered />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Hook Candidates</h2>
        <PhraseList items={brief.hookCandidates} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Chantable Lines</h2>
        <PhraseList items={brief.chantableLines} />
      </section>

      {brief.signalTextureNotes.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Signal Texture</h2>
          <ul className="space-y-2">
            {brief.signalTextureNotes.map((note) => (
              <li key={note} className="flex items-start justify-between gap-3 text-sm text-gray-300">
                <span>{note}</span>
                <CopyButton text={note} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {brief.shoutouts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Shoutouts</h2>
          <p className="text-sm text-gray-300">{brief.shoutouts.join(", ")}</p>
        </section>
      )}

      {brief.sunoPrompts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Suno Prompts</h2>
          <div className="space-y-4">
            {brief.sunoPrompts.map((prompt, i) => (
              <div key={i} className="rounded-xl border border-gray-700/60 bg-[#1f1f1f] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Prompt {i + 1}</p>
                  <CopyButton text={prompt} label="Copy prompt" />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{prompt}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-700/60 bg-transparent p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Source Material</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">Interview</dt>
            <dd className="font-medium text-white">{brief.sourceCounts.interviewTurns}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Live lines</dt>
            <dd className="font-medium text-white">{brief.sourceCounts.liveSubmissions}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Signal rounds</dt>
            <dd className="font-medium text-white">{brief.sourceCounts.signalRounds}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Phrase cards</dt>
            <dd className="font-medium text-white">{brief.sourceCounts.phraseCards}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default function CompositionBriefView({
  eventId: eventIdProp = null,
  sessionId: sessionIdProp = null,
  embedded = false,
}: {
  eventId?: string | null;
  sessionId?: string | null;
  embedded?: boolean;
} = {}) {
  const searchParams = useSearchParams();
  const eventId = (eventIdProp ?? searchParams.get("eventId")?.trim()) || null;
  const sessionId = (sessionIdProp ?? searchParams.get("sessionId")?.trim()) || null;

  const [brief, setBrief] = useState<CompositionBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = { eventId, sessionId };
  const hasScope = !!(eventId || sessionId);

  const loadBrief = useCallback(async () => {
    if (!hasScope) {
      setBrief(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cached = await getCompositionBrief(scope);
      setBrief(cached);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load brief");
    } finally {
      setLoading(false);
    }
  }, [eventId, sessionId, hasScope]);

  useEffect(() => {
    loadBrief();
  }, [loadBrief]);

  const handleGenerate = async () => {
    if (!hasScope) return;
    setGenerating(true);
    setError(null);
    try {
      const next = await generateCompositionBrief(scope);
      setBrief(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={embedded ? "text-white" : "text-white"}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {!embedded && (
            <>
              <h1 className="text-xl font-bold sm:text-2xl">Composition Brief</h1>
              <p className="mt-1 text-sm text-gray-400">
                Organized creative material from audience participation and Signal choices.
              </p>
            </>
          )}
          {hasScope && (
            <p className={`font-mono text-xs text-gray-500 ${embedded ? "" : "mt-2"}`}>
              {eventId && `event ${eventId}`}
              {eventId && sessionId && " · "}
              {sessionId && `session ${sessionId}`}
            </p>
          )}
        </div>
        {!embedded && (
          <Link href="/admin/live" className="text-sm font-medium text-gray-500 hover:text-gray-300">
            ← Live
          </Link>
        )}
      </div>

      {!hasScope && (
        <section className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-6">
          <p className="text-sm text-amber-100">
            Open this page from a live session or event, or add{" "}
            <code className="rounded bg-black/30 px-1">?sessionId=…</code> or{" "}
            <code className="rounded bg-black/30 px-1">?eventId=…</code> to the URL.
          </p>
        </section>
      )}

      {hasScope && (
        <section className="mb-6 rounded-2xl border border-gray-700/60 bg-transparent p-4 sm:p-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black hover:bg-[#bdf25e] disabled:opacity-50"
            >
              {generating ? "Generating…" : brief ? "Regenerate Brief" : "Generate Brief"}
            </button>
            {brief && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    downloadText(
                      briefToJson(brief),
                      briefDownloadFilename(brief, "json"),
                      "application/json; charset=utf-8"
                    )
                  }
                  className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadText(
                      briefToMarkdown(brief),
                      briefDownloadFilename(brief, "md"),
                      "text/markdown; charset=utf-8"
                    )
                  }
                  className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Download Markdown
                </button>
                <CopyButton
                  text={briefToMarkdown(brief)}
                  label="Copy all (Markdown)"
                />
              </>
            )}
          </div>
          {brief && (
            <p className="mt-3 text-xs text-gray-500">
              Last generated {new Date(brief.generatedAt).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-800/60 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {hasScope && loading && !brief && (
        <p className="text-sm text-gray-500">Loading cached brief…</p>
      )}

      {hasScope && !loading && !brief && !generating && !error && (
        <p className="text-sm text-gray-500">No brief yet. Generate one from the material in this event or session.</p>
      )}

      {brief && <BriefSections brief={brief} />}
    </div>
  );
}
