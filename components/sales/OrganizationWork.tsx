"use client";

import { useState } from "react";
import FollowUpControls from "@/components/sales/FollowUpControls";
import { QueueOpportunityNotes } from "@/components/sales/QueueOrgWorkspace";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import { SALES_INITIATIVES, readSalesInitiative, type SalesInitiativeKey } from "@/lib/sales/initiatives";
import type { Opportunity, Organization } from "@/lib/sales/types";

const INITIATIVE_KEYS = Object.keys(SALES_INITIATIVES) as SalesInitiativeKey[];

const fieldClass =
  "rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500";

export default function OrganizationWork({
  organization,
  opportunities,
  onChanged,
}: {
  organization: Organization;
  opportunities: Opportunity[];
  onChanged: () => Promise<void> | void;
}) {
  const savedInitiative = readSalesInitiative(organization.importMetadata) ?? "";
  const savedNotes =
    typeof organization.importMetadata?.operatorNotes === "string" ? organization.importMetadata.operatorNotes : "";
  const [initiative, setInitiative] = useState<string>(savedInitiative);
  const [context, setContext] = useState(savedNotes);
  const [saving, setSaving] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opportunity =
    opportunities.find((item) => item.title.trim().toLowerCase() === organization.name.trim().toLowerCase()) ??
    opportunities[0] ??
    null;

  async function saveContext() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/sales/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorNotes: context.trim() || null,
          salesInitiative: initiative || null,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not save"));
      setMessage("Saved.");
      await onChanged();
    } catch (err) {
      setError(publicErrorMessage(err, "Could not save"));
    } finally {
      setSaving(false);
    }
  }

  async function addToQueue() {
    setQueueing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/sales/organizations/${organization.id}/queue`, { method: "POST" });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not add to the queue"));
      setMessage((data as { message?: string }).message ?? "In the queue.");
      await onChanged();
    } catch (err) {
      setError(publicErrorMessage(err, "Could not add to the queue"));
    } finally {
      setQueueing(false);
    }
  }

  return (
    <section className="border-b border-[var(--csc-row-divider)] pb-6">
      <p className="csc-eyebrow">This account</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Category</span>
            <select
              value={initiative}
              onChange={(event) => setInitiative(event.target.value)}
              className={`mt-1 w-full ${fieldClass}`}
            >
              <option value="">Choose a category</option>
              {INITIATIVE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SALES_INITIATIVES[key].label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Context</span>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              rows={4}
              placeholder="What you know about this organization. Stays on the account."
              className={`mt-1 w-full ${fieldClass}`}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveContext()}
              className="rounded-full border border-[var(--csc-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--csc-accent)] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save context"}
            </button>
            <button
              type="button"
              disabled={queueing}
              onClick={() => void addToQueue()}
              className="rounded-full bg-[var(--csc-accent)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              {queueing ? "Adding…" : "Add to queue"}
            </button>
          </div>
          {message ? <p className="mt-2 text-sm text-[var(--csc-accent)]">{message}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        </div>
        <div className="space-y-3">
          {opportunity ? (
            <>
              <FollowUpControls
                opportunityId={opportunity.id}
                nextFollowUpAt={opportunity.nextFollowUpAt}
                onSaved={() => void onChanged()}
              />
              <QueueOpportunityNotes opportunityId={opportunity.id} />
            </>
          ) : (
            <p className="text-sm text-gray-400">
              Add to queue to set a follow-up date and keep notes on this deal. The date becomes a one-minute appointment on your Google calendar.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
