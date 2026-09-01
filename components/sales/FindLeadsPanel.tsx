"use client";

import { useEffect, useMemo, useState } from "react";
import type { Organization } from "@/lib/sales/types";
import { CONTACT_ROLE_PRESETS, type FindLeadsAction } from "@/lib/sales/find-leads";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

type FindLeadsPanelProps = {
  organization: Organization | null;
  initialAction?: FindLeadsAction;
  initialRole?: string;
};

const ACTIONS: { id: FindLeadsAction; label: string; hint: string }[] = [
  { id: "contact", label: "Contact at org", hint: "Find the fan-engagement person (or another role) and draft." },
  { id: "similar", label: "More like this", hint: "Discover N equivalent organizations." },
  { id: "discover", label: "New leads", hint: "Search the web for orgs that aren’t in the list yet." },
  { id: "fill_queue", label: "Unstick queue", hint: "Re-run high-score leads stuck without a verified email." },
];

export default function FindLeadsPanel({ organization, initialAction, initialRole }: FindLeadsPanelProps) {
  const [action, setAction] = useState<FindLeadsAction>(initialAction ?? "contact");
  const [roleId, setRoleId] = useState<string>(CONTACT_ROLE_PRESETS[0].id);
  const [customRole, setCustomRole] = useState(initialRole ?? "");
  const [count, setCount] = useState(10);
  const [focus, setFocus] = useState("");
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAction) setAction(initialAction);
  }, [initialAction]);

  useEffect(() => {
    if (initialRole?.trim()) setCustomRole(initialRole.trim());
  }, [initialRole]);

  useEffect(() => {
    if (initialAction !== "similar" || !organization?.name) return;
    setIntent((prev) => {
      if (prev.trim()) return prev;
      return `10 more like ${organization.name}${initialRole ? ` (${initialRole})` : ""}`;
    });
  }, [initialAction, organization?.name, initialRole]);

  const roleHint = useMemo(() => {
    if (customRole.trim()) return customRole.trim();
    return CONTACT_ROLE_PRESETS.find((p) => p.id === roleId)?.hint ?? CONTACT_ROLE_PRESETS[0].hint;
  }, [customRole, roleId]);

  const needsOrg = action === "contact" || action === "similar";
  const similarRoleHint = action === "similar" ? customRole.trim() || null : null;

  async function run() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/sales/find-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          intent: intent.trim() || undefined,
          organizationId: organization?.id,
          organizationName: organization?.name,
          roleHint: action === "contact" ? roleHint : similarRoleHint,
          count,
          focus: action === "discover" ? focus.trim() || undefined : undefined,
        }),
        signal: AbortSignal.timeout(300_000),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Find leads failed"));
      setMessage((data as { message?: string }).message ?? "Done.");
    } catch (err) {
      setError(publicErrorMessage(err, "Find leads failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-950/50 p-4">
      <h2 className="text-sm font-semibold text-white">Find leads</h2>
      <p className="mt-1 text-xs text-gray-500">
        Point it. Contact at an org, more like this one, or a new search. Never auto-sends.
      </p>

      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        rows={2}
        placeholder="e.g. Find the fan engagement person at this org — or 10 more like this"
        className="mt-3 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
      />

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {ACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAction(item.id)}
            className={`rounded-lg px-2 py-2 text-left text-xs font-medium ${
              action === item.id ? "bg-white text-gray-900" : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-600">{ACTIONS.find((a) => a.id === action)?.hint}</p>

      {needsOrg && !organization ? (
        <p className="mt-3 text-xs text-amber-300">Select an organization in search first.</p>
      ) : null}

      {action === "contact" || action === "similar" ? (
        <div className="mt-3 space-y-2">
          {action === "contact" ? (
            <div className="flex flex-wrap gap-1.5">
              {CONTACT_ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setRoleId(preset.id);
                    setCustomRole("");
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    roleId === preset.id && !customRole
                      ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                      : "border-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
          <input
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            placeholder={action === "similar" ? "Optional role to look for…" : "Or type a role…"}
            className="w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder:text-gray-600"
          />
        </div>
      ) : null}

      {action === "similar" || action === "discover" || action === "fill_queue" ? (
        <label className="mt-3 block text-xs text-gray-500">
          How many
          <input
            type="number"
            min={1}
            max={25}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(25, Number(e.target.value) || 10)))}
            className="mt-1 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-sm text-white"
          />
        </label>
      ) : null}

      {action === "discover" ? (
        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="Focus — D1 basketball athletic departments, municipal leagues…"
          className="mt-2 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder:text-gray-600"
        />
      ) : null}

      <button
        type="button"
        disabled={busy || (needsOrg && !organization && !intent.trim())}
        onClick={() => void run()}
        className="mt-4 w-full rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
      >
        {busy ? "Working…" : "Run"}
      </button>

      {message ? <p className="mt-3 text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
