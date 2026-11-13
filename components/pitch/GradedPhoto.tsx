"use client";

import React, { useId } from "react";
import { overlayTable } from "@/lib/pitches/photo-overlay";

/**
 * Magenta-and-gold grade matching the library photos that are already pink.
 * Shadows go magenta, midtones stay salmon, and the brightest lights stay warm gold.
 * `amount` is how much of that grade shows. 1 is the full grade. 0 is the media as shot.
 * When `video` is set, the grade runs on the looping video; the still stays as the poster.
 */
export function GradedPhoto({
  src,
  alt,
  video,
  overlay,
  amount = 1,
  color,
  className = "",
  imgClassName = "",
  parallax = false,
}: {
  src: string;
  alt: string;
  /** Optional looping background video. The still stays as the poster. */
  video?: string;
  overlay?: "salmon";
  amount?: number;
  color?: string;
  className?: string;
  imgClassName?: string;
  /** Pitch scroll decks shift the plate with the page. */
  parallax?: boolean;
}) {
  const filterId = `pitch-salmon-${useId().replace(/:/g, "")}`;
  const stops = overlayTable(color);
  const strength = overlay === "salmon" ? Math.min(1, Math.max(0, amount)) : 0;
  const graded = strength > 0;
  const mix = strength < 0.999;
  const mediaClass = `h-full w-full object-cover ${imgClassName}`;
  const mediaStyle = graded ? { filter: `url(#${filterId})` } : undefined;
  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      {...(parallax ? { "data-parallax": "" } : {})}
    >
      {graded ? (
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
              result="gray"
            />
            <feComponentTransfer in="gray" result="graded">
              <feFuncR type="table" tableValues={stops.r} />
              <feFuncG type="table" tableValues={stops.g} />
              <feFuncB type="table" tableValues={stops.b} />
            </feComponentTransfer>
            {mix ? (
              <feComposite
                in="graded"
                in2="SourceGraphic"
                operator="arithmetic"
                k1="0"
                k2={strength}
                k3={1 - strength}
                k4="0"
              />
            ) : null}
          </filter>
        </svg>
      ) : null}
      {video ? (
        <video
          key={video}
          src={video}
          poster={src}
          className={mediaClass}
          style={mediaStyle}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          aria-label={alt || undefined}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={mediaClass} style={mediaStyle} />
      )}
    </span>
  );
}
