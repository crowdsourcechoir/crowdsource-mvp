"use client";

import { motion } from "framer-motion";

type ContributionTextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  accentColor: string;
  hint?: string | null;
  inputMode?: "text" | "email";
  autoComplete?: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
};

/**
 * Compact text field + solid lime confirm — matches the moment-pad review control.
 * Prefer TextMomentPad for full participant moments (prompt + circle + field).
 */
export default function ContributionTextField({
  value,
  onChange,
  onSubmit,
  placeholder = "Type your answer…",
  disabled,
  submitDisabled,
  submitLabel = "✓ Continue",
  accentColor,
  hint,
  inputMode = "text",
  autoComplete = "off",
  inputRef,
}: ContributionTextFieldProps) {
  const hasText = value.trim().length > 0;

  return (
    <div className="mx-auto max-w-xs space-y-3 text-center">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!submitDisabled) onSubmit();
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
        disabled={disabled || submitDisabled}
        whileTap={{ scale: 0.97 }}
        className="flex min-h-[44px] w-full select-none items-center justify-center rounded-xl px-3 py-2 font-mono text-xs font-semibold [touch-action:manipulation] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: accentColor, color: "#1a1530" }}
      >
        {submitLabel}
      </motion.button>
    </div>
  );
}
