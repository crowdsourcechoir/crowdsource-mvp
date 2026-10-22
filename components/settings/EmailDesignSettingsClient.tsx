"use client";

import { useEffect, useState } from "react";
import { FieldLabel, SettingsButton, SettingsPanel, TextField } from "@/components/settings/ui";
import { DEFAULT_EMAIL_TOKENS, type EmailDesignTokens } from "@/lib/marketing/render/tokens";

const COLOR_KEYS = ["canvas", "surface", "ink", "muted", "brand", "brandInk", "link"] as const;

export default function EmailDesignSettingsClient() {
  const [tokens, setTokens] = useState<EmailDesignTokens>(DEFAULT_EMAIL_TOKENS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/design", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setTokens(data.tokens);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/design", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setTokens(data.tokens);
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        title="Email design"
        description="Starts from the app and the SoBECA Song Garden: black canvas, lime, Bebas Neue headlines, and Space Mono text. The Crowdsource Choir logo stays at the top of every email. The admin shell keeps its own design system."
        actions={
          <SettingsButton variant="primary" disabled={busy} onClick={() => save()}>
            Save
          </SettingsButton>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Email width" value={tokens.emailWidth} onChange={(emailWidth) => setTokens({ ...tokens, emailWidth })} />
          <NumberField label="Content width" value={tokens.contentWidth} onChange={(contentWidth) => setTokens({ ...tokens, contentWidth })} />
          <TextRow label="Heading font" value={tokens.fonts.heading} onChange={(heading) => setTokens({ ...tokens, fonts: { ...tokens.fonts, heading } })} />
          <TextRow label="Body font" value={tokens.fonts.body} onChange={(body) => setTokens({ ...tokens, fonts: { ...tokens.fonts, body } })} />
          <TextRow label="UI font" value={tokens.fonts.ui} onChange={(ui) => setTokens({ ...tokens, fonts: { ...tokens.fonts, ui } })} />
        </div>
      </SettingsPanel>
      <SettingsPanel title="Colors">
        <div className="grid gap-3 sm:grid-cols-2">
          {COLOR_KEYS.map((key) => (
            <div key={key}>
              <FieldLabel>{key}</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tokens.colors[key]}
                  onChange={(event) => setTokens({ ...tokens, colors: { ...tokens.colors, [key]: event.target.value } })}
                  className="h-9 w-9 rounded border border-white/20 bg-transparent"
                />
                <TextField value={tokens.colors[key]} onChange={(value) => setTokens({ ...tokens, colors: { ...tokens.colors, [key]: value } })} />
              </div>
            </div>
          ))}
        </div>
      </SettingsPanel>
      <SettingsPanel title="Spacing, button, images">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Spacing small" value={tokens.spacing.small} onChange={(small) => setTokens({ ...tokens, spacing: { ...tokens.spacing, small } })} />
          <NumberField label="Spacing medium" value={tokens.spacing.medium} onChange={(medium) => setTokens({ ...tokens, spacing: { ...tokens.spacing, medium } })} />
          <NumberField label="Spacing large" value={tokens.spacing.large} onChange={(large) => setTokens({ ...tokens, spacing: { ...tokens.spacing, large } })} />
          <NumberField label="Spacing xl" value={tokens.spacing.xl} onChange={(xl) => setTokens({ ...tokens, spacing: { ...tokens.spacing, xl } })} />
          <NumberField label="Button padding X" value={tokens.button.paddingX} onChange={(paddingX) => setTokens({ ...tokens, button: { ...tokens.button, paddingX } })} />
          <NumberField label="Button padding Y" value={tokens.button.paddingY} onChange={(paddingY) => setTokens({ ...tokens, button: { ...tokens.button, paddingY } })} />
          <NumberField label="Button size" value={tokens.button.fontSize} onChange={(fontSize) => setTokens({ ...tokens, button: { ...tokens.button, fontSize } })} />
          <NumberField label="Button radius" value={tokens.radii.button} onChange={(button) => setTokens({ ...tokens, radii: { ...tokens.radii, button } })} />
          <NumberField label="Portrait width" value={tokens.image.portraitWidth} onChange={(portraitWidth) => setTokens({ ...tokens, image: { ...tokens.image, portraitWidth } })} />
          <NumberField label="Square width" value={tokens.image.squareWidth} onChange={(squareWidth) => setTokens({ ...tokens, image: { ...tokens.image, squareWidth } })} />
          <NumberField label="Landscape width" value={tokens.image.landscapeWidth} onChange={(landscapeWidth) => setTokens({ ...tokens, image: { ...tokens.image, landscapeWidth } })} />
        </div>
      </SettingsPanel>
      {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <TextField value={String(value)} onChange={(next) => onChange(Number(next) || 0)} />
    </div>
  );
}

function TextRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="sm:col-span-2">
      <FieldLabel>{label}</FieldLabel>
      <TextField value={value} onChange={onChange} />
    </div>
  );
}
