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
  firstWorldSceneUrl,
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
  firstSceneUrl?: string | null;
  /** When set, used for cache lookup / fetch instead of the route slug. */
  slug?: string;
};

/**
 * Song Garden loading shell — paints the first storyboard still when known
 * so entry matches the journey world instead of a blank brand wash.
 */
export default function WorldLoadingShell({
  primaryColor: primaryProp,
  accentColor: accentProp,
  firstSceneUrl: sceneProp,
  slug: slugProp,
}: WorldLoadingShellProps) {
  const params = useParams();
  const slug =
    slugProp?.trim() || (typeof params?.slug === "string" ? params.slug.trim() : "");

  const [theme, setTheme] = useState<CachedWorldTheme>(() => {
    if (primaryProp?.trim() && accentProp?.trim()) {
      return {
        primaryColor: primaryProp.trim(),
        accentColor: accentProp.trim(),
        firstSceneUrl: sceneProp?.trim() || null,
      };
    }
    return (
      readWorldThemeCache(slug) ?? {
        primaryColor: FALLBACK_PRIMARY,
        accentColor: FALLBACK_ACCENT,
        firstSceneUrl: null,
      }
    );
  });

  useEffect(() => {
    if (primaryProp?.trim() && accentProp?.trim()) {
      const next = {
        primaryColor: primaryProp.trim(),
        accentColor: accentProp.trim(),
        firstSceneUrl: sceneProp?.trim() || null,
      };
      setTheme(next);
      if (slug) writeWorldThemeCache(slug, next);
      return;
    }
    if (!slug) return;

    const cached = readWorldThemeCache(slug);
    if (cached) {
      setTheme(cached);
      // Still refresh from network so first-time scene URLs get cached after generate.
    }

    let cancelled = false;
    getEventBySlug(slug)
      .then((event) => {
        if (cancelled || !event) return;
        const world = resolveWorldConfig(event);
        const next = {
          primaryColor: world.primaryColor || DEFAULT_PRIMARY_COLOR,
          accentColor: world.accentColor || DEFAULT_ACCENT_COLOR,
          firstSceneUrl: firstWorldSceneUrl(world),
        };
        setTheme(next);
        writeWorldThemeCache(slug, next);
      })
      .catch(() => {
        // keep fallback / cache
      });
    return () => {
      cancelled = true;
    };
  }, [slug, primaryProp, accentProp, sceneProp]);

  const primary = theme.primaryColor;
  const accent = theme.accentColor;
  const sceneUrl = theme.firstSceneUrl?.trim() || null;

  return (
    <div
      className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden"
      style={{
        background: primary,
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Entering the Song Garden"
    >
      {sceneUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${sceneUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.12) brightness(1.12) contrast(1.04)",
          }}
          aria-hidden
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 50% -10%, ${accent}1f, ${primary} 55%)`,
          }}
          aria-hidden
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${primary}22 0%, transparent 28%, transparent 72%, ${primary}33 100%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
        {!sceneUrl ? (
          <>
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
          </>
        ) : (
          <div
            className="h-7 w-7 animate-spin rounded-full border-2 border-white/20"
            style={{ borderTopColor: accent }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
