"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_DESIGN_TOKENS,
  applyDesignTokensToDocument,
  broadcastDesignTokens,
  normalizeTokens,
  readStoredDesignTokens,
  writeStoredDesignTokens,
  type DesignSystemTokens,
} from "@/lib/design-system/tokens";

const DIVIDER_PRESETS: { label: string; value: string }[] = [
  { label: "Faint (default)", value: "rgba(255, 255, 255, 0.10)" },
  { label: "Softer", value: "rgba(255, 255, 255, 0.06)" },
  { label: "Stronger", value: "rgba(255, 255, 255, 0.16)" },
  { label: "Hidden", value: "rgba(255, 255, 255, 0)" },
];

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-medium text-gray-300">{children}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

/**
 * Master chrome controls — edits apply live across admin via CSS variables.
 */
export default function DesignSystemControls() {
  const [tokens, setTokens] = useState<DesignSystemTokens>(DEFAULT_DESIGN_TOKENS);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const stored = readStoredDesignTokens();
    setTokens(stored);
    applyDesignTokensToDocument(stored);
  }, []);

  function commit(next: DesignSystemTokens) {
    const normalized = normalizeTokens(next);
    setTokens(normalized);
    writeStoredDesignTokens(normalized);
    applyDesignTokensToDocument(normalized);
    broadcastDesignTokens(normalized);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  }

  function patch(partial: Partial<DesignSystemTokens>) {
    commit({ ...tokens, ...partial });
  }

  return (
    <section className="space-y-6 rounded-xl border border-white/10 bg-transparent p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="csc-eyebrow">Master chrome</p>
          <h2 className="mt-2 text-base font-semibold text-white">Tokens</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            These drive list rows, links, circular controls, and the accent across admin. New pages should use{" "}
            <code className="text-[11px] text-gray-300">.csc-list</code>,{" "}
            <code className="text-[11px] text-gray-300">.csc-list-row</code>,{" "}
            <code className="text-[11px] text-gray-300">.csc-link</code>, and{" "}
            <code className="text-[11px] text-gray-300">.csc-btn-circle</code> — not one-off colors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash ? <span className="text-xs font-medium text-[var(--csc-accent)]">Saved</span> : null}
          <button
            type="button"
            onClick={() => commit(DEFAULT_DESIGN_TOKENS)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-[var(--csc-accent)] hover:text-white"
          >
            Reset defaults
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <FieldLabel hint="Links, eyebrows, hover outlines, primary fills">Accent (lime / yellow)</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={tokens.accent}
              onChange={(e) => patch({ accent: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded border border-white/15 bg-black p-1"
              aria-label="Accent color"
            />
            <input
              type="text"
              value={tokens.accent}
              onChange={(e) => patch({ accent: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 py-2 font-mono text-sm text-white"
            />
          </div>
        </div>

        <div>
          <FieldLabel hint="True black by default — keep shell uniform">Shell background</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={tokens.shellBg}
              onChange={(e) => patch({ shellBg: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded border border-white/15 bg-black p-1"
              aria-label="Shell background"
            />
            <input
              type="text"
              value={tokens.shellBg}
              onChange={(e) => patch({ shellBg: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 py-2 font-mono text-sm text-white"
            />
          </div>
        </div>

        <div>
          <FieldLabel hint="Flush lists — no vertical gap between rows">Row divider</FieldLabel>
          <select
            value={tokens.rowDivider}
            onChange={(e) => patch({ rowDivider: e.target.value })}
            className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
          >
            {DIVIDER_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel hint="Vertical padding inside each list row">
            Row padding ({tokens.rowPaddingY}px)
          </FieldLabel>
          <input
            type="range"
            min={8}
            max={32}
            step={1}
            value={tokens.rowPaddingY}
            onChange={(e) => patch({ rowPaddingY: Number(e.target.value) })}
            className="w-full accent-[var(--csc-accent)]"
          />
        </div>

        <div>
          <FieldLabel hint="Hover / focus outline thickness">
            Outline width ({tokens.outlineWidth}px)
          </FieldLabel>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={tokens.outlineWidth}
            onChange={(e) => patch({ outlineWidth: Number(e.target.value) })}
            className="w-full accent-[var(--csc-accent)]"
          />
        </div>

        <div>
          <FieldLabel hint="Icon-only circular controls">
            Circle button size ({tokens.circleButtonSize}px)
          </FieldLabel>
          <input
            type="range"
            min={24}
            max={44}
            step={2}
            value={tokens.circleButtonSize}
            onChange={(e) => patch({ circleButtonSize: Number(e.target.value) })}
            className="w-full accent-[var(--csc-accent)]"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-300">Live preview</p>
        <div className="csc-list">
          <div className="csc-list-row" tabIndex={0}>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">Transparent row</p>
              <p className="mt-0.5 truncate text-xs text-gray-500">Hover for accent outline · flush dividers</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href="#design-system" className="csc-link text-xs font-medium">
                Lime link
              </a>
              <button type="button" className="csc-btn-circle text-sm" aria-label="Preview circle button">
                +
              </button>
            </div>
          </div>
          <div className="csc-list-row" tabIndex={0}>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">Second row</p>
              <p className="mt-0.5 truncate text-xs text-gray-500">Same height rhythm as Composer / Blooms</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white"
            >
              Chip
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
