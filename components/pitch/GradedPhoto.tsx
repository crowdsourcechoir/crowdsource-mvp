"use client";

import { useId } from "react";

/**
 * Magenta-and-gold grade matching the library photos that are already pink.
 * Shadows go magenta, midtones stay salmon, and the brightest lights stay warm gold.
 */
export function GradedPhoto({
  src,
  alt,
  overlay,
  className = "",
  imgClassName = "",
}: {
  src: string;
  alt: string;
  overlay?: "salmon";
  className?: string;
  imgClassName?: string;
}) {
  const filterId = `pitch-salmon-${useId().replace(/:/g, "")}`;
  const graded = overlay === "salmon";
  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {graded ? (
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
            />
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.50 0.92 1" />
              <feFuncG type="table" tableValues="0.14 0.36 0.86" />
              <feFuncB type="table" tableValues="0.28 0.48 0.50" />
            </feComponentTransfer>
          </filter>
        </svg>
      ) : null}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover ${imgClassName}`}
        style={graded ? { filter: `url(#${filterId})` } : undefined}
      />
    </span>
  );
}
