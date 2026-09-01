"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AgentRun, Contact, Opportunity, Organization, PipelineRun, ResearchFinding } from "@/lib/sales/types";
import { PERSONA_STRATEGIES } from "@/lib/sales/outreach/persona";
import FindMoreLikeRoleLink from "@/components/sales/FindMoreLikeRoleLink";

type PipelineRunWithStages = PipelineRun & { agentRuns: AgentRun[] };
type FindingWithUrl = ResearchFinding & { sourceUrl: string };

type DetailResponse = {
  organization: Organization;
  contacts: Contact[];
  opportunities: Opportunity[];
  pipelineRuns: PipelineRunWithStages[];
  findings: FindingWithUrl[];
};

const STAGE_STATUS_COLOR: Record<string, string> = {
  succeeded: "text-emerald-400",
  failed: "text-red-400",
  running: "text-sky-400",
  skipped: "text-gray-500",
  pending: "text-gray-500",
  retrying: "text-amber-400",
};

export default function OrganizationDetailClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [togglingClient, setTogglingClient] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/organizations/${orgId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load organization");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization");
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runPipeline() {
    setRunning(true);
    try {
      const res = await fetch("/api/sales/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Pipeline run failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline run failed");
    } finally {
      setRunning(false);
    }
  }

  async function toggleExistingClient() {
    if (!data) return;
    setTogglingClient(true);
    try {
      const res = await fetch(`/api/sales/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isExistingClient: !data.organization.isExistingClient }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setTogglingClient(false);
    }
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-gray-400">Loading…</p>;

  const { organization, contacts, opportunities, pipelineRuns, findings } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{organization.name}</h1>
            {organization.isExistingClient && (
              <span className="rounded-full border border-emerald-700 px-2 py-0.5 text-xs font-medium text-emerald-400">Existing client</span>
            )}
          </div>
          <p className="text-sm text-gray-400">{organization.websiteUrl ?? "No website on file"}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleExistingClient}
            disabled={togglingClient}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            {organization.isExistingClient ? "Unmark existing client" : "Mark as existing client"}
          </button>
          <button
            onClick={runPipeline}
            disabled={running || organization.isExistingClient}
            title={organization.isExistingClient ? "Existing clients are never prospected — unmark to run the pipeline." : undefined}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50"
          >
            {running ? "Running pipeline…" : "Run pipeline"}
          </button>
        </div>
      </div>
      {organization.isExistingClient && (
        <p className="rounded-md border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          Marked as an existing client — the pipeline will never run for this organization, and it won&apos;t be prospected.
        </p>
      )}

      <section className="rounded-xl border border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Opportunities ({opportunities.length})</h2>
        {opportunities.length === 0 ? (
          <p className="text-sm text-gray-500">None yet — run the pipeline to detect opportunities.</p>
        ) : (
          <ul className="space-y-2">
            {opportunities.map((o) => (
              <li key={o.id} className="flex items-center justify-between rounded-md border border-gray-800 px-3 py-2">
                <div>
                  <Link href={`/admin/sales/opportunities/${o.id}`} className="font-medium text-gray-100 hover:underline">
                    {o.title}
                  </Link>
                  <span className="ml-2 text-xs text-gray-500">{o.status}</span>
                  {o.status === "awaiting_contact" && (
                    <span
                      className="ml-2 rounded-full border border-amber-700 px-2 py-0.5 text-xs font-medium text-amber-400"
                      title="Scored and briefed, but no contact with a verified email yet — not in the approval queue until one is found."
                    >
                      Blocked: no verified contact
                    </span>
                  )}
                </div>
                {o.targetContactRoleHint && !contacts.length && (
                  <span className="text-xs text-gray-500">Target role: {o.targetContactRoleHint}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Contacts ({contacts.length})</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-500">No contacts yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-200">
            {contacts.map((c) => (
              <li key={c.id}>
                {c.fullName ?? "Unnamed"} — {c.roleTitle ?? "unknown role"}{" "}
                <span className="text-gray-500">
                  {c.email ?? "no email"} · {c.emailVerificationStatus} · {c.source}
                </span>
                {c.outreachPersona !== "other" && (
                  <span className="ml-1 text-sky-500">· {PERSONA_STRATEGIES[c.outreachPersona].label}</span>
                )}
                {c.roleTitle ? (
                  <span className="ml-2">
                    <FindMoreLikeRoleLink orgId={organization.id} role={c.roleTitle} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Research findings ({findings.length})</h2>
        {findings.length === 0 ? (
          <p className="text-sm text-gray-500">No findings yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-300">
            {findings.map((f) => (
              <li key={f.id}>
                <span className="text-gray-500">[{f.claimType}]</span>{" "}
                {f.claimText}{" "}
                {f.sourceUrl && (
                  <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-500 underline">
                    source
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Pipeline runs ({pipelineRuns.length})</h2>
        {pipelineRuns.length === 0 ? (
          <p className="text-sm text-gray-500">No pipeline runs yet.</p>
        ) : (
          <div className="space-y-4">
            {pipelineRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-gray-800 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {run.trigger} · {new Date(run.createdAt).toLocaleString()}
                  </span>
                  <span className={STAGE_STATUS_COLOR[run.status] ?? "text-gray-400"}>{run.status}</span>
                </div>
                <ol className="flex flex-wrap gap-2 text-xs">
                  {run.agentRuns.map((ar) => (
                    <li key={ar.id} className={`rounded-full border border-gray-800 px-2 py-1 ${STAGE_STATUS_COLOR[ar.status] ?? "text-gray-400"}`}>
                      {ar.stage}: {ar.status}
                      {ar.error && <span className="ml-1 text-red-400" title={ar.error}>⚠</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
