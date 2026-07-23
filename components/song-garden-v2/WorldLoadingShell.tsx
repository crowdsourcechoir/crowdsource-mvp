"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEventBySlug } from "@/data/eventsClient";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  resolveWorldConfig,
} from "@/lib/song-garden-v2/world-config";
import {
  readWorldThemeCache,
  writeWorldThemeCache,
  type CachedWorldTheme,
} from "@/lib/song-garden-v2/world-theme-cache";

/** Neutral fallback — never flash the old purple/lime brand defaults on reload. */
const FALLBACK_PRIMARY = "#0c0c0f";
const FALLBACK_ACCENT = "#e8e8e8";

type WorldLoadingShellProps = {
  primaryColor?: string;
  accentColor?: string;
  /** When set, used for cache lookup / fetch instead of the route slug. */
  slug?: string;
};

function lightenHex(hex: string, amount = 0.18): string {
  const raw = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return hex;
  const n = parseInt(raw, 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amount));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amount));
  const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Song Garden loading shell — uses the event's world primary/accent when known
 * (props, session cache, or a quick fetch). Avoids the hardcoded purple/lime flash.
 */
export default function WorldLoadingShell({
  primaryColor: primaryProp,
  accentColor: accentProp,
  slug: slugProp,
}: WorldLoadingShellProps) {
  const params = useParams();
  const slug =
    slugProp?.trim() || (typeof params?.slug === "string" ? params.slug.trim() : "");

  const [theme, setTheme] = useState<CachedWorldTheme>(() => {
    if (primaryProp?.trim() && accentProp?.trim()) {
      return { primaryColor: primaryProp.trim(), accentColor: accentProp.trim() };
    }
    return readWorldThemeCache(slug) ?? { primaryColor: FALLBACK_PRIMARY, accentColor: FALLBACK_ACCENT };
  });

  useEffect(() => {
    if (primaryProp?.trim() && accentProp?.trim()) {
      const next = { primaryColor: primaryProp.trim(), accentColor: accentProp.trim() };
      setTheme(next);
      if (slug) writeWorldThemeCache(slug, next);
      return;
    }
    if (!slug) return;

    const cached = readWorldThemeCache(slug);
    if (cached) {
      setTheme(cached);
      return;
    }

    let cancelled = false;
    getEventBySlug(slug)
      .then((event) => {
        if (cancelled || !event) return;
        const world = resolveWorldConfig(event);
        const next = {
          primaryColor: world.primaryColor || DEFAULT_PRIMARY_COLOR,
          accentColor: world.accentColor || DEFAULT_ACCENT_COLOR,
        };
        setTheme(next);
        writeWorldThemeCache(slug, next);
      })
      .catch(() => {
        // keep fallback
      });
    return () => {
      cancelled = true;
    };
  }, [slug, primaryProp, accentProp]);

  const primary = theme.primaryColor;
  const accent = theme.accentColor;
  const mid = lightenHex(primary, 0.12);

  return (
    <div
      className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden"
      style={{
        background: `radial-gradient(120% 90% at 50% -10%, ${mid} 0%, ${primary} 55%, #050508 100%)`,
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Entering the Song Garden"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 70%, ${accent}1f, transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.35em]"
          style={{ color: accent, opacity: 0.9 }}
        >
          Song Garden
        </p>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15"
          style={{ borderTopColor: accent }}
          aria-hidden
        />
      </div>
    </div>
  );
}
