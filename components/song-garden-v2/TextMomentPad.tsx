"use client";

import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import TypewriterText from "@/components/TypewriterText";

type TextMomentPadProps = {
  promptText: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  accentColor: string;
  placeholder?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  hint?: string | null;
  inputMode?: "text" | "email";
  autoComplete?: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
  /** Extra controls above the field (captcha, warnings). */
  children?: ReactNode;
};

/**
 * Text / name contribution: prompt + field + confirm.
 * No decorative circle — typing already has a clear primary control.
 */
export default function TextMomentPad({
  promptText,
  value,
  onChange,
  onSubmit,
  accentColor,
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

  const setRefs = (el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    inputRef?.(el);
  };

  return (
    <div className="space-y-5 text-center">
      <p className="mx-auto max-w-xs font-mono text-[1.0625rem] leading-snug text-gray-100 sm:text-lg">
        <TypewriterText key={promptText} text={promptText} speed={9} className="inline" />
      </p>

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
          className="w-full resize-none rounded-2xl border-2 bg-black/20 px-4 py-3.5 text-center font-mono text-base text-white placeholder:text-gray-500 focus:outline-none"
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
