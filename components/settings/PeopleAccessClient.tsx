"use client";

import { useCallback, useEffect, useState } from "react";
import { FieldLabel, InlineNote, SettingsButton, SettingsPanel, StatusPill, TextField } from "@/components/settings/ui";

type Grant = { capability: "compose" | "steward" | "sales"; scopeType: "bloom" | "garden" | "sales"; scopeId: string | null };
type Person = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  status: "invited" | "active" | "disabled";
  grants: Grant[];
};
type Option = { id: string; title: string };

const EMPTY_GRANT: Grant = { capability: "compose", scopeType: "bloom", scopeId: "" };

function grantLabel(grant: Grant, blooms: Option[], gardens: Option[]): string {
  if (grant.capability === "sales") return "Sales";
  const list = grant.scopeType === "garden" ? gardens : blooms;
  const name = list.find((item) => item.id === grant.scopeId)?.title || "Untitled";
  if (grant.capability === "compose") return `Composer · ${name}`;
  return grant.scopeType === "garden" ? `Garden steward · ${name}` : `Bloom steward · ${name}`;
}

export default function PeopleAccessClient() {
  const [people, setPeople] = useState<Person[]>([]);
  const [blooms, setBlooms] = useState<Option[]>([]);
  const [gardens, setGardens] = useState<Option[]>([]);
  const [mailHint, setMailHint] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [grants, setGrants] = useState<Grant[]>([{ ...EMPTY_GRANT }]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [peopleRes, eventsRes, gardensRes] = await Promise.all([
      fetch("/api/operators", { cache: "no-store" }),
      fetch("/api/events", { cache: "no-store" }),
      fetch("/api/gardens", { cache: "no-store" }),
    ]);
    const peopleBody = await peopleRes.json();
    if (!peopleRes.ok) {
      setSetupError(peopleBody.setup ? peopleBody.error : null);
      if (!peopleBody.setup) setError(peopleBody.error || "Could not load people.");
      return;
    }
    setPeople(peopleBody.people || []);
    setMailHint(peopleBody.mailHint || null);
    setSetupError(null);
    const events = await eventsRes.json().catch(() => []);
    const gardenBody = await gardensRes.json().catch(() => ({ gardens: [] }));
    setBlooms(
      (Array.isArray(events) ? events : [])
        .filter((event: { id?: string; slug?: string }) => event.id && event.slug)
        .map((event: { id: string; title?: string }) => ({ id: event.id, title: event.title || "Untitled Bloom" }))
    );
    setGardens(
      (gardenBody.gardens || []).map((garden: { id: string; title?: string }) => ({
        id: garden.id,
        title: garden.title || "Untitled Garden",
      }))
    );
  }, []);

  useEffect(() => {
    void load().catch(() => setError("Could not load people."));
  }, [load]);

  function updateGrant(index: number, next: Grant) {
    setGrants((current) => current.map((grant, i) => (i === index ? next : grant)));
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, grants }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not add this person.");
      setName("");
      setEmail("");
      setGrants([{ ...EMPTY_GRANT }]);
      setMessage(`Invite sent to ${email}. They choose their own password.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this person.");
    } finally {
      setBusy(false);
    }
  }

  async function patchPerson(id: string, body: unknown, okMessage: string) {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/operators/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Could not update.");
      return;
    }
    setMessage(okMessage);
    await load();
  }

  async function resend(id: string) {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/operators/${id}`, { method: "POST" });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Could not send email.");
      return;
    }
    setMessage("Email sent.");
  }

  return (
    <div className="space-y-6">
      {setupError ? <InlineNote tone="warn">{setupError}</InlineNote> : null}
      {mailHint ? <InlineNote tone="warn">{mailHint}</InlineNote> : null}
      {error ? <InlineNote tone="off">{error}</InlineNote> : null}
      {message ? <InlineNote tone="ok">{message}</InlineNote> : null}

      <SettingsPanel
        eyebrow="Invite"
        title="Add a person"
        description="They get an email, choose a password, and land in the rooms you grant. You never see the password."
      >
        <form onSubmit={addPerson} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Name</FieldLabel>
              <TextField value={name} onChange={setName} placeholder="Name" />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <TextField value={email} onChange={setEmail} type="email" placeholder="name@studio.com" />
            </div>
          </div>
          <div className="space-y-3">
            {grants.map((grant, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
                <select
                  value={grant.capability === "sales" ? "sales" : `${grant.capability}:${grant.scopeType}`}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "sales") updateGrant(index, { capability: "sales", scopeType: "sales", scopeId: null });
                    else if (value === "steward:garden") updateGrant(index, { capability: "steward", scopeType: "garden", scopeId: "" });
                    else if (value === "steward:bloom") updateGrant(index, { capability: "steward", scopeType: "bloom", scopeId: "" });
                    else updateGrant(index, { capability: "compose", scopeType: "bloom", scopeId: "" });
                  }}
                  className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white"
                >
                  <option value="compose:bloom">Composer on a Bloom</option>
                  <option value="steward:bloom">Steward of a Bloom</option>
                  <option value="steward:garden">Steward of a Song Garden</option>
                  <option value="sales">Sales</option>
                </select>
                {grant.capability === "sales" ? (
                  <p className="self-center text-sm text-gray-400">Pipeline and drafts. Sending stays with you.</p>
                ) : (
                  <select
                    value={grant.scopeId || ""}
                    onChange={(e) => updateGrant(index, { ...grant, scopeId: e.target.value })}
                    className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white"
                  >
                    <option value="">Choose…</option>
                    {(grant.scopeType === "garden" ? gardens : blooms).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                )}
                <SettingsButton
                  variant="ghost"
                  disabled={grants.length === 1}
                  onClick={() => setGrants((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </SettingsButton>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <SettingsButton variant="ghost" onClick={() => setGrants((current) => [...current, { ...EMPTY_GRANT }])}>
              Add permission
            </SettingsButton>
            <SettingsButton variant="primary" type="submit" disabled={busy || Boolean(setupError)}>
              {busy ? "Sending…" : "Send invite"}
            </SettingsButton>
          </div>
        </form>
      </SettingsPanel>

      <SettingsPanel eyebrow="People" title="Who has access">
        <div className="csc-list">
          {people.map((person) => (
            <div key={person.id} className="csc-list-row flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">
                  {person.name}{" "}
                  <StatusPill tone={person.status === "active" ? "ok" : person.status === "disabled" ? "off" : "warn"}>
                    {person.role === "owner" ? "Owner" : person.status}
                  </StatusPill>
                </p>
                <p className="mt-1 text-xs text-gray-400">{person.email}</p>
                <p className="mt-1 text-xs text-gray-300">
                  {person.role === "owner"
                    ? "Full access"
                    : person.grants.map((grant) => grantLabel(grant, blooms, gardens)).join(" · ") || "No permissions"}
                </p>
              </div>
              {person.role === "owner" ? null : (
                <div className="flex flex-wrap gap-2">
                  <SettingsButton onClick={() => void resend(person.id)}>
                    {person.status === "active" ? "Send reset" : "Resend invite"}
                  </SettingsButton>
                  <SettingsButton
                    variant={person.status === "disabled" ? "primary" : "danger"}
                    onClick={() =>
                      void patchPerson(
                        person.id,
                        { status: person.status === "disabled" ? "active" : "disabled" },
                        person.status === "disabled" ? "Enabled." : "Disabled. Their session ends."
                      )
                    }
                  >
                    {person.status === "disabled" ? "Enable" : "Disable"}
                  </SettingsButton>
                </div>
              )}
            </div>
          ))}
        </div>
      </SettingsPanel>
    </div>
  );
}
