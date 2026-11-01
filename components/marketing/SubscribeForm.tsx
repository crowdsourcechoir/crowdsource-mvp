"use client";

import { useState, type FormEvent } from "react";
import { FieldLabel, SettingsButton, SettingsPanel, TextField } from "@/components/settings/ui";

const COPY = {
  subscribed: "You're on the list.",
  already: "You're already on the list.",
  kept_off: "This address stays off the list. If that's a mistake, reply to a recent Crowdsource Choir email.",
} as const;

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, city, company_website: companyWebsite }),
      });
      const data = (await res.json()) as { error?: string; state?: unknown };
      if (!res.ok) throw new Error(data.error ?? "Could not subscribe");
      const state: keyof typeof COPY = data.state === "already" || data.state === "kept_off" ? data.state : "subscribed";
      setMessage(COPY[state]);
      if (state === "subscribed") {
        setEmail("");
        setDisplayName("");
        setCity("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not subscribe");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <SettingsPanel
        eyebrow="Crowdsource Choir"
        title="Join the list"
        description="Occasional emails about the choir, songs, and shows. Unsubscribe from any message."
      >
        <div className="grid gap-3">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextField value={email} onChange={setEmail} placeholder="you@example.com" />
          </div>
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextField value={displayName} onChange={setDisplayName} placeholder="Optional" />
          </div>
          <div>
            <FieldLabel>City</FieldLabel>
            <TextField value={city} onChange={setCity} placeholder="Optional" />
          </div>
          <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            <label>
              Company website
              <input
                value={companyWebsite}
                onChange={(event) => setCompanyWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>
        </div>
        <div className="mt-4">
          <SettingsButton variant="primary" type="submit" disabled={busy || !email.trim()}>
            Join
          </SettingsButton>
        </div>
        {message ? <p className="mt-4 text-sm text-[var(--csc-accent)]">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </SettingsPanel>
    </form>
  );
}
