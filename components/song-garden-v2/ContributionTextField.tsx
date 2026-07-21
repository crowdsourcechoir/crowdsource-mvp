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
 * One obvious action, always. A single text field plus a single primary button —
 * never a menu, never a branching choice.
 */
export default function ContributionTextField({
  value,
  onChange,
  onSubmit,
  placeholder = "Type your answer…",
  disabled,
  submitDisabled,
  submitLabel = "Continue",
  accentColor,
  hint,
  inputMode = "text",
  autoComplete = "off",
  inputRef,
}: ContributionTextFieldProps) {
  return (
    <div className="space-y-4">
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
        className="w-full resize-none rounded-2xl border-2 bg-black/25 px-4 py-3.5 font-mono text-base text-white placeholder:text-gray-400 focus:outline-none"
        style={{ borderColor: `${accentColor}66` }}
      />
      {hint && (
        <p className="text-center font-mono text-xs" style={{ color: accentColor, opacity: 0.85 }}>
          {hint}
        </p>
      )}
      <motion.button
        type="button"
        onClick={onSubmit}
        disabled={disabled || submitDisabled}
        whileTap={{ scale: 0.97 }}
        className="flex min-h-[52px] w-full items-center justify-center rounded-2xl px-6 py-3 font-mono text-base font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: accentColor, color: "#1a1530" }}
      >
        {submitLabel}
      </motion.button>
    </div>
  );
}
