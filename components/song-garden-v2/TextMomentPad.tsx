"use client";

import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";

type TextMomentPadProps = {
  promptText: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  accentColor: string;
  /** Circle label — e.g. "TYPE" / "NAME". */
  buttonLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  hint?: string | null;
  inputMode?: "text" | "email";
  autoComplete?: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
  /** Extra controls between the circle and the field (captcha, warnings). */
  children?: ReactNode;
};

/**
 * Text / name contribution using the same circle-card language as SoundMomentPad:
 * monospaced prompt, lime accent rings, solid confirm control.
 */
export default function TextMomentPad({
  promptText,
  value,
  onChange,
  onSubmit,
  accentColor,
  buttonLabel = "Type",
  placeholder = "Type your answer…",
  disabled,
  submitDisabled,
  submitLabel = "✓ Continue",
  hint,
  inputMode = "text",
  autoComplete = "off",
  inputRef,
  children,
}: TextMomentPadProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const hasText = value.trim().length > 0;
  const canSubmit = !disabled && !submitDisabled && hasText;
  const label = buttonLabel.trim() || "Type";

  const setRefs = (el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    inputRef?.(el);
  };

  const focusField = () => {
    if (disabled) return;
    localRef.current?.focus();
  };

  const handleCircleTap = () => {
    if (canSubmit) {
      onSubmit();
      return;
    }
    focusField();
  };

  return (
    <div className="space-y-6 text-center">
      <p className="mx-auto max-w-xs font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
        {promptText}
      </p>

      <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={accentColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={hasText ? 0 : 2 * Math.PI * 45 * 0.92}
            opacity={hasText ? 1 : 0.55}
          />
        </svg>

        <motion.button
          type="button"
          onClick={handleCircleTap}
          disabled={disabled}
          whileTap={{ scale: 0.94 }}
          className="flex h-28 w-28 [touch-action:manipulation] select-none flex-col items-center justify-center rounded-full font-mono text-xs font-semibold uppercase tracking-wide transition [-webkit-tap-highlight-color:transparent] [-webkit-user-select:none] disabled:cursor-default disabled:opacity-50"
          style={{
            background: hasText ? accentColor : `${accentColor}1f`,
            color: hasText ? "#1a1530" : accentColor,
            border: `2px solid ${accentColor}`,
            boxShadow: `0 0 0 10px ${accentColor}14, 0 0 0 20px ${accentColor}0a`,
          }}
        >
          {hasText ? <span>Got it</span> : <span>{label}</span>}
        </motion.button>
      </div>

      {children}

      <div className="mx-auto max-w-xs space-y-3">
        <textarea
          ref={setRefs}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          enterKeyHint="send"
          inputMode={inputMode}
          autoComplete={autoComplete}
          className="w-full resize-none rounded-2xl border-2 bg-black/25 px-4 py-3.5 text-center font-mono text-base text-white placeholder:text-gray-500 focus:outline-none"
          style={{
            borderColor: hasText ? accentColor : `${accentColor}66`,
            boxShadow: hasText ? `0 0 24px -12px ${accentColor}88` : undefined,
          }}
        />
        {hint && (
          <p className="font-mono text-xs" style={{ color: accentColor, opacity: 0.85 }}>
            {hint}
          </p>
        )}
        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          whileTap={{ scale: 0.97 }}
          className="flex min-h-[44px] w-full select-none items-center justify-center rounded-xl px-3 py-2 font-mono text-xs font-semibold [touch-action:manipulation] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: accentColor, color: "#1a1530" }}
        >
          {submitLabel}
        </motion.button>
      </div>
    </div>
  );
}
