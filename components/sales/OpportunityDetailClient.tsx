"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { QueueItemDetail } from "@/lib/sales/types";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import { resolveProspectWebsite } from "@/lib/sales/prospectWebsite";
import EmailLaunchLink from "@/components/sales/EmailLaunchLink";

export default function OpportunityDetailClient({ opportunityId }: { opportunityId: string }) {
  const [detail, setDetail] = useState<QueueItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load opportunity");
      setDetail(json.detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load opportunity");
    }
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!detail) return <p className="text-gray-400">Loading…</p>;

  const prospectWebsite = resolveProspectWebsite({
    eventWebsiteUrl: detail.opportunity.eventWebsiteUrl,
    organizationWebsiteUrl: detail.organization.websiteUrl,
    findingSourceUrls: detail.findings.map((f) => f.sourceUrl),
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/sales/organizations/${detail.organization.id}`} className="text-sm text-gray-500 hover:underline">
          ← {detail.organization.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-white">{detail.opportunity.title}</h1>
        <p className="text-sm text-gray-400">
          Status: {detail.queueItem.status} {detail.opportunityTypeLabel ? `· ${detail.opportunityTypeLabel}` : ""}
        </p>
        {prospectWebsite ? (
          <p className="mt-1 text-sm text-gray-300">
            <span className="text-gray-500">{prospectWebsite.label}: </span>
            <a
              href={prospectWebsite.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sky-400 underline hover:text-sky-300"
            >
              {prospectWebsite.url.replace(/^https?:\/\//i, "")}
            </a>
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-500">No website on file</p>
        )}
      </div>

      {detail.score && (
        <section className="rounded-xl border border-gray-800 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Score: {detail.score.totalScore.toFixed(0)}/100 ({detail.score.confidence} confidence)
          </h2>
          <p className="text-sm text-gray-300">{detail.score.rationale}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(detail.score.componentScores).map(([key, c]) => (
              <div key={key} className="rounded-md border border-gray-800 bg-gray-900/40 p-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">{key}</p>
                <p className="text-sm text-gray-200">
                  {c.score}/10 <span className="text-gray-500">× {c.weight}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {detail.draft && (
        <section className="rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Draft email ({detail.draft.status})</h2>
            {detail.contact?.email && (
              <EmailLaunchLink
                to={detail.contact.email}
                subject={detail.draft.editedSubject ?? detail.draft.aiSubject}
                body={detail.draft.editedBody ?? detail.draft.aiBody}
              />
            )}
          </div>
          <p className="font-medium text-gray-100">{detail.draft.editedSubject ?? detail.draft.aiSubject}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
            {stripEmailSignature(detail.draft.editedBody ?? detail.draft.aiBody)}
          </p>
          {detail.contact?.email && (
            <p className="mt-2 text-xs text-gray-600">
              Note: webmail (e.g. Gmail) only opens automatically if you’ve explicitly granted it mailto: handler permission in this
              browser — the “Open in email client” button also copies the draft to your clipboard as a backup.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-gray-800 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Findings ({detail.findings.length})</h2>
        <ul className="space-y-1 text-sm text-gray-300">
          {detail.findings.map((f) => (
            <li key={f.id}>
              <span className={f.origin === "human_provided" ? "text-amber-400" : "text-sky-400"}>[{f.claimType}]</span> {f.claimText}{" "}
              {f.sourceUrl && (
                <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-500 underline">
                  source
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Link href="/admin/sales/queue" className="inline-block text-sm text-gray-400 underline">
        Go to approval queue to decide →
      </Link>
    </div>
  );
}
