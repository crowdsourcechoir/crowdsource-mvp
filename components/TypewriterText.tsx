"use client";

import { useState, useEffect } from "react";

const CHAR_MS = 18;

type Props = {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
};

/**
 * Reveals text character-by-character for a chatbot feel.
 * Optional onComplete when full text is shown.
 */
export default function TypewriterText({ text, speed = CHAR_MS, onComplete, className = "" }: Props) {
  const [visibleLength, setVisibleLength] = useState(0);
  const fullLen = text.length;

  useEffect(() => {
    setVisibleLength(0);
  }, [text]);

  useEffect(() => {
    if (visibleLength >= fullLen) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => {
      setVisibleLength((n) => Math.min(n + 1, fullLen));
    }, speed);
    return () => clearTimeout(t);
  }, [visibleLength, fullLen, speed, onComplete]);

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
