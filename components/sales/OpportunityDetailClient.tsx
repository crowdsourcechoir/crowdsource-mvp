"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { OpportunityPageDetail, ScoreComponentKey } from "@/lib/sales/types";
import { SCORE_COMPONENT_LABELS } from "@/lib/sales/scoring/model";
import { gmailThreadUrl } from "@/lib/sales/gmail/constants";
import { PERSONA_STRATEGIES } from "@/lib/sales/outreach/persona";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import { funnelStageLabel } from "@/lib/sales/funnel-labels";

const FINDING_LABELS: Record<string, string> = {
  audience_size: "Audience",
  event_date: "Event date",
  decision_maker: "Decision maker",
  budget_signal: "Budget",
  program_fit_signal: "Program fit",
  other: "Other",
};

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-emerald-300 border-emerald-700 bg-emerald-950/40" : score >= 45 ? "text-amber-300 border-amber-700 bg-amber-950/30" : "text-gray-300 border-gray-700 bg-gray-900/40";
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-lg border px-3 py-1.5 ${color}`}>
      <span className="text-2xl font-semibold tabular-nums">{score.toFixed(0)}</span>
      <span className="text-xs opacity-70">/100</span>
    </span>
  );
}

export default function OpportunityDetailClient({ opportunityId }: { opportunityId: string }) {
  const [detail, setDetail] = useState<OpportunityPageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [showEmailBody, setShowEmailBody] = useState(false);
  const [showFindings, setShowFindings] = useState(false);

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

  const findingsByType = useMemo(() => {
    if (!detail) return [];
    const groups = new Map<string, typeof detail.findings>();
    for (const f of detail.findings) {
      const list = groups.get(f.claimType) ?? [];
      list.push(f);
      groups.set(f.claimType, list);
    }
    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      label: FINDING_LABELS[type] ?? type.replace(/_/g, " "),
      items,
    }));
  }, [detail]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!detail) return <p className="text-gray-400">Loading…</p>;

  const { organization, opportunity, contact, contacts, score, draft, brief } = detail;
  const emailSubject = draft ? draft.editedSubject ?? draft.aiSubject : null;
  const emailBody = draft ? stripEmailSignature(draft.editedBody ?? draft.aiBody) : null;
  const otherContacts = contacts.filter((c) => c.id !== contact?.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/sales/funnel" className="text-sm text-gray-500 hover:text-gray-300 hover:underline">
          ← Funnel
        </Link>
        <p className="mt-3 text-sm text-gray-400">
          <Link href={`/admin/sales/organizations/${organization.id}`} className="hover:underline">
            {organization.name}
          </Link>
          {detail.organizationTypeLabel ? ` · ${detail.organizationTypeLabel}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">{opportunity.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md border border-gray-700 px-2 py-0.5 text-gray-300">{funnelStageLabel(opportunity.relationshipStage)}</span>
          {detail.opportunityTypeLabel && (
            <span className="rounded-md border border-gray-800 px-2 py-0.5 text-gray-400">{detail.opportunityTypeLabel}</span>
          )}
          {detail.emailSentAt ? (
            <span className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-emerald-300">
              Email sent {formatWhen(detail.emailSentAt)}
            </span>
          ) : (
            <span className="rounded-md border border-amber-800 bg-amber-950/30 px-2 py-0.5 text-amber-300">Email not sent yet</span>
          )}
          {detail.emailRepliedAt && (
            <span className="rounded-md border border-sky-800 bg-sky-950/40 px-2 py-0.5 text-sky-300">
              Reply {formatWhen(detail.emailRepliedAt)}
            </span>
          )}
        </div>
        {opportunity.eventOrInitiativeName && (
          <p className="mt-2 text-sm text-gray-400">
            {opportunity.eventOrInitiativeName}
            {opportunity.eventDateEstimate ? ` · ${opportunity.eventDateEstimate}` : ""}
          </p>
        )}
      </div>

      {/* Score — summary first, details on click */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Score</h2>
            {score ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ScoreBadge score={score.totalScore} />
                <span className="text-sm text-gray-400 capitalize">{score.confidence} confidence</span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No score yet</p>
            )}
          </div>
          {score && (
            <button
              type="button"
              onClick={() => setShowScoreDetails((v) => !v)}
              className="text-sm text-sky-400 hover:underline"
            >
              {showScoreDetails ? "Hide details" : "View score details"}
            </button>
          )}
        </div>
        {score && !showScoreDetails && (
          <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {(Object.keys(score.componentScores) as ScoreComponentKey[])
              .sort((a, b) => score.componentScores[b].score - score.componentScores[a].score)
              .map((key) => (
                <li key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-400">{SCORE_COMPONENT_LABELS[key] ?? key}</span>
                  <span className="tabular-nums text-gray-200">{score.componentScores[key].score}/10</span>
                </li>
              ))}
          </ul>
        )}
        {score && showScoreDetails && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-300">{score.rationale}</p>
            <ul className="space-y-2">
              {(Object.keys(score.componentScores) as ScoreComponentKey[]).map((key) => {
                const c = score.componentScores[key];
                return (
                  <li key={key} className="rounded-lg border border-gray-800 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-gray-200">{SCORE_COMPONENT_LABELS[key] ?? key}</span>
                      <span className="tabular-nums text-gray-300">{c.score}/10</span>
                    </div>
                    {c.rationale && <p className="mt-1 text-xs text-gray-500">{c.rationale}</p>}
                  </li>
                );
              })}
            </ul>
            {score.missingInformation.length > 0 && (
              <p className="text-sm text-amber-400">Missing: {score.missingInformation.join("; ")}</p>
            )}
          </div>
        )}
      </section>

      {/* Contact */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</h2>
        {contact ? (
          <div className="mt-2 space-y-1">
            <p className="text-lg font-medium text-white">{contact.fullName ?? "Unnamed contact"}</p>
            {contact.roleTitle && <p className="text-sm text-gray-400">{contact.roleTitle}</p>}
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="block text-sm text-sky-400 hover:underline">
                {contact.email}
              </a>
            ) : (
              <p className="text-sm text-amber-400">No email on file</p>
            )}
            {contact.phone && <p className="text-sm text-gray-400">{contact.phone}</p>}
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="block text-sm text-sky-400 hover:underline">
                LinkedIn
              </a>
            )}
            <p className="pt-1 text-xs text-gray-600">
              {PERSONA_STRATEGIES[contact.outreachPersona].label}
              {contact.emailVerificationStatus ? ` · ${contact.emailVerificationStatus.replace(/_/g, " ")}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No contact identified yet.</p>
        )}
        {otherContacts.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-300">
              {otherContacts.length} other contact{otherContacts.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-2 border-t border-gray-800 pt-2">
              {otherContacts.map((c) => (
                <li key={c.id} className="text-sm text-gray-400">
                  <span className="text-gray-200">{c.fullName ?? "Unnamed"}</span>
                  {c.roleTitle ? ` — ${c.roleTitle}` : ""}
                  {c.email ? (
                    <>
                      {" · "}
                      <a href={`mailto:${c.email}`} className="text-sky-400 hover:underline">
                        {c.email}
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Links */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Websites & pages</h2>
        {detail.links.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {detail.links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
                >
                  <span className="shrink-0 text-sm text-sky-400 group-hover:underline">
                    {link.kind === "organization" ? "Org site" : link.kind === "conference" ? "Conference" : "Source"}
                  </span>
                  <span className="truncate text-sm text-gray-300 group-hover:underline">{link.label}</span>
                </a>
                <p className="truncate text-xs text-gray-600">{link.url}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No website links found yet.</p>
        )}
        {opportunity.gmailThreadId && (
          <a
            href={gmailThreadUrl(opportunity.gmailThreadId)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-sky-400 hover:underline"
          >
            Open Gmail thread →
          </a>
        )}
      </section>

      {/* Brief */}
      {brief && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quick brief</h2>
          <p className="mt-2 text-sm text-gray-200">{brief.summary}</p>
          <p className="mt-2 text-sm text-gray-400">
            <span className="text-gray-500">Angle: </span>
            {brief.recommendedAngle}
          </p>
          {brief.risks.length > 0 && (
            <p className="mt-2 text-sm text-amber-300/90">
              <span className="text-amber-500/80">Risks: </span>
              {brief.risks.join(" · ")}
            </p>
          )}
        </section>
      )}

      {/* Email — collapsed by default */}
      {draft && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outreach email</h2>
              <p className="mt-2 font-medium text-gray-100">{emailSubject}</p>
              <p className="mt-1 text-xs text-gray-500">
                {detail.emailSentAt ? `Sent ${formatWhen(detail.emailSentAt)}` : "Draft only — not sent yet"}
                {draft.status ? ` · ${draft.status.replace(/_/g, " ")}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => setShowEmailBody((v) => !v)} className="text-sm text-sky-400 hover:underline">
              {showEmailBody ? "Hide email" : "View full email"}
            </button>
          </div>
          {showEmailBody && emailBody && (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-gray-800 bg-black/20 p-3 text-sm text-gray-300">
              {emailBody}
            </pre>
          )}
        </section>
      )}

      {/* Findings — collapsed, grouped */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Research notes ({detail.findings.length})
          </h2>
          {detail.findings.length > 0 && (
            <button type="button" onClick={() => setShowFindings((v) => !v)} className="text-sm text-sky-400 hover:underline">
              {showFindings ? "Hide notes" : "Show research notes"}
            </button>
          )}
        </div>
        {!showFindings && detail.findings.length > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Raw research extractions are hidden by default — open only if you need to verify a claim.
          </p>
        )}
        {showFindings && (
          <div className="mt-3 space-y-4">
            {findingsByType.map((group) => (
              <div key={group.type}>
                <h3 className="text-sm font-medium text-gray-300">{group.label}</h3>
                <ul className="mt-1 space-y-1.5">
                  {group.items.map((f) => (
                    <li key={f.id} className="text-sm text-gray-400">
                      {f.claimText}{" "}
                      {f.sourceUrl && (
                        <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-600 underline hover:text-sky-400">
                          source
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-4 pb-6 text-sm">
        <Link href="/admin/sales/funnel" className="text-gray-400 underline hover:text-gray-200">
          Back to funnel
        </Link>
        <Link href="/admin/sales/queue" className="text-gray-400 underline hover:text-gray-200">
          Approval queue
        </Link>
        <Link href={`/admin/sales/organizations/${organization.id}`} className="text-gray-400 underline hover:text-gray-200">
          Organization
        </Link>
      </div>
    </div>
  );
}
