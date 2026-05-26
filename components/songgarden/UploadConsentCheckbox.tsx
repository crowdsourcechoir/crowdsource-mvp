"use client";

export const UPLOAD_CONSENT_TEXT =
  "I own this recording or have permission to share it.";

type UploadConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export default function UploadConsentCheckbox({
  checked,
  onChange,
  className = "",
}: UploadConsentCheckboxProps) {
  return (
    <label className={`flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-left ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--crowdsource-accent,#CFFF81)]"
      />
      <span className="font-mono text-sm leading-snug text-gray-300 sm:text-xs sm:leading-relaxed">
        {UPLOAD_CONSENT_TEXT}
      </span>
    </label>
  );
}
