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
    <div
      className={`crowdsource-journey-consent ${checked ? "is-checked" : "is-pending"} ${className}`}
      role="group"
      aria-label="Contribution consent"
    >
      {!checked ? (
        <p className="crowdsource-journey-consent-heading" id="contribution-consent-heading">
          Check this box to continue
        </p>
      ) : (
        <p className="crowdsource-journey-consent-heading is-checked" aria-hidden>
          ✓ Ready to go
        </p>
      )}
      <label className="crowdsource-journey-consent-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby="contribution-consent-heading"
          className="crowdsource-journey-consent-checkbox"
        />
        <span className="crowdsource-journey-consent-text">{text}</span>
      </label>
    </div>
  );
}
