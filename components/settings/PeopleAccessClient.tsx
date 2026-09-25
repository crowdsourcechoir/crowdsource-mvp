"use client";

import { useCallback, useEffect, useState } from "react";
import { FieldLabel, InlineNote, SettingsButton, SettingsPanel, SettingsSelect, StatusPill, TextField } from "@/components/settings/ui";

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

function grantKind(grant: Grant): string {
  if (grant.capability === "sales") return "sales";
  return `${grant.capability}:${grant.scopeType}`;
}

function grantFromKind(kind: string, current: Grant): Grant {
  if (kind === "sales") return { capability: "sales", scopeType: "sales", scopeId: null };
  if (kind === "steward:garden") {
    return { capability: "steward", scopeType: "garden", scopeId: current.scopeType === "garden" ? current.scopeId : "" };
  }
  if (kind === "steward:bloom") {
    return { capability: "steward", scopeType: "bloom", scopeId: current.scopeType === "bloom" ? current.scopeId : "" };
  }
  return { capability: "compose", scopeType: "bloom", scopeId: current.scopeType === "bloom" ? current.scopeId : "" };
}

function cloneGrants(grants: Grant[]): Grant[] {
  if (grants.length === 0) return [{ ...EMPTY_GRANT }];
  return grants.map((grant) => ({
    ...grant,
    scopeId: grant.capability === "sales" ? null : grant.scopeId || "",
  }));
}

function grantLabel(grant: Grant, blooms: Option[], gardens: Option[]): string {
  if (grant.capability === "sales") return "Sales";
  const list = grant.scopeType === "garden" ? gardens : blooms;
  const name = list.find((item) => item.id === grant.scopeId)?.title || "Untitled";
  if (grant.capability === "compose") return `Composer · ${name}`;
  return grant.scopeType === "garden" ? `Garden steward · ${name}` : `Bloom steward · ${name}`;
}

function GrantFields({
  grants,
  blooms,
  gardens,
  onChange,
}: {
  grants: Grant[];
  blooms: Option[];
  gardens: Option[];
  onChange: (grants: Grant[]) => void;
}) {
  function updateGrant(index: number, next: Grant) {
    onChange(grants.map((grant, i) => (i === index ? next : grant)));
  }

  return (
    <div className="space-y-3">
      {grants.map((grant, index) => {
        const options = grant.scopeType === "garden" ? gardens : blooms;
        const missing = Boolean(grant.scopeId && !options.some((item) => item.id === grant.scopeId));
        return (
          <div key={`${grant.capability}-${grant.scopeType}-${index}`} className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
            <SettingsSelect
              ariaLabel="Permission"
              value={grantKind(grant)}
              onChange={(value) => updateGrant(index, grantFromKind(value, grant))}
            >
              <option value="compose:bloom">Composer on a Bloom</option>
              <option value="steward:bloom">Steward of a Bloom</option>
              <option value="steward:garden">Steward of a Song Garden</option>
              <option value="sales">Sales</option>
            </SettingsSelect>
            {grant.capability === "sales" ? (
              <p className="self-center text-sm text-gray-400">Pipeline and drafts. Sending stays with you.</p>
            ) : (
              <SettingsSelect
                ariaLabel={grant.scopeType === "garden" ? "Song Garden" : "Bloom"}
                value={grant.scopeId || ""}
                onChange={(value) => updateGrant(index, { ...grant, scopeId: value })}
              >
                <option value="">Choose…</option>
                {missing ? <option value={grant.scopeId || ""}>Untitled</option> : null}
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </SettingsSelect>
            )}
            <SettingsButton variant="ghost" disabled={grants.length === 1} onClick={() => onChange(grants.filter((_, i) => i !== index))}>
              Remove
            </SettingsButton>
          </div>
        );
      })}
    </div>
  );
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftGrants, setDraftGrants] = useState<Grant[]>([{ ...EMPTY_GRANT }]);
  const [savingId, setSavingId] = useState<string | null>(null);

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
      return false;
    }
    setMessage(okMessage);
    await load();
    return true;
  }

  async function saveGrants(person: Person) {
    setSavingId(person.id);
    const saved = await patchPerson(
      person.id,
      { grants: draftGrants },
      "Permissions saved. Their session ends, and the next sign-in opens only these rooms."
    );
    setSavingId(null);
    if (saved) setEditingId(null);
  }

  function startEdit(person: Person) {
    setError(null);
    setMessage(null);
    setEditingId(person.id);
    setDraftGrants(cloneGrants(person.grants));
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
          <GrantFields grants={grants} blooms={blooms} gardens={gardens} onChange={setGrants} />
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
          {people.map((person) => {
            const editing = editingId === person.id;
            return (
              <div key={person.id} className="csc-list-row flex-col items-stretch gap-3">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {person.name}{" "}
                      <StatusPill tone={person.status === "active" ? "ok" : person.status === "disabled" ? "off" : "warn"}>
                        {person.role === "owner" ? "Owner" : person.status}
                      </StatusPill>
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{person.email}</p>
                    {editing ? null : (
                      <p className="mt-1 text-xs text-gray-300">
                        {person.role === "owner"
                          ? "Full access"
                          : person.grants.map((grant) => grantLabel(grant, blooms, gardens)).join(" · ") || "No permissions"}
                      </p>
                    )}
                  </div>
                  {person.role === "owner" || editing ? null : (
                    <div className="flex flex-wrap gap-2">
                      <SettingsButton onClick={() => startEdit(person)}>Edit permissions</SettingsButton>
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
                {editing ? (
                  <div className="space-y-3">
                    <GrantFields grants={draftGrants} blooms={blooms} gardens={gardens} onChange={setDraftGrants} />
                    <div className="flex flex-wrap gap-2">
                      <SettingsButton variant="ghost" onClick={() => setDraftGrants((current) => [...current, { ...EMPTY_GRANT }])}>
                        Add permission
                      </SettingsButton>
                      <SettingsButton variant="primary" disabled={savingId === person.id} onClick={() => void saveGrants(person)}>
                        {savingId === person.id ? "Saving…" : "Save permissions"}
                      </SettingsButton>
                      <SettingsButton
                        onClick={() => {
                          setEditingId(null);
                        }}
                      >
                        Cancel
                      </SettingsButton>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </SettingsPanel>
    </div>
  );
}
