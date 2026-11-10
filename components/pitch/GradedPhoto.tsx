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
              <feFuncR type="table" tableValues="0.48 0.90 1" />
              <feFuncG type="table" tableValues="0.12 0.34 0.84" />
              <feFuncB type="table" tableValues="0.32 0.62 0.52" />
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
