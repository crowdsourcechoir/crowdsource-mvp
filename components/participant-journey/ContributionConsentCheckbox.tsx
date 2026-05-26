"use client";

type ContributionConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  text: string;
  className?: string;
};

export default function ContributionConsentCheckbox({
  checked,
  onChange,
  text,
  className = "",
}: ContributionConsentCheckboxProps) {
  return (
    <label className={`flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-left ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--crowdsource-accent,#CFFF81)]"
      />
      <span className="font-mono text-sm leading-snug text-gray-300 sm:text-xs sm:leading-relaxed">
        {text}
      </span>
    </label>
  );
}
