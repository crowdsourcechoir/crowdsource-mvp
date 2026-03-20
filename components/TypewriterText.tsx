"use client";

import { useState, useEffect } from "react";

const CHAR_MS = 18;

type Props = {
  text: string;
  /** Show full text immediately (no per-character delay). */
  instant?: boolean;
  speed?: number;
  onComplete?: () => void;
  className?: string;
};

/**
 * Reveals text character-by-character for a chatbot feel.
 * Optional onComplete when full text is shown.
 */
export default function TypewriterText({
  text,
  instant = false,
  speed = CHAR_MS,
  onComplete,
  className = "",
}: Props) {
  const [visibleLength, setVisibleLength] = useState(0);
  const fullLen = text.length;

  useEffect(() => {
    if (instant) {
      onComplete?.();
    }
  }, [text, instant, onComplete]);

  useEffect(() => {
    if (instant) return;
    setVisibleLength(0);
  }, [text, instant]);

  useEffect(() => {
    if (instant) return;
    if (visibleLength >= fullLen) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => {
      setVisibleLength((n) => Math.min(n + 1, fullLen));
    }, speed);
    return () => clearTimeout(t);
  }, [visibleLength, fullLen, speed, onComplete, instant]);

  if (instant) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {text.slice(0, visibleLength)}
      {visibleLength < fullLen && (
        <span className="animate-pulse" aria-hidden>
          |
        </span>
      )}
    </span>
  );
}
