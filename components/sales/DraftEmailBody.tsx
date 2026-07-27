"use client";

import { CROWDSOURCE_SITE_URL, ensureEmailSignature, splitBodyForSignatureLink } from "@/lib/sales/outreach/signature";

/** Renders a draft body with "Crowdsource Choir" hyperlinked only in the signature block. */
export default function DraftEmailBody({ body, className }: { body: string; className?: string }) {
  const parts = splitBodyForSignatureLink(body);
  if (!parts) {
    return <p className={className ?? "whitespace-pre-wrap text-gray-300"}>{ensureEmailSignature(body)}</p>;
  }

  return (
    <p className={className ?? "whitespace-pre-wrap text-gray-300"}>
      {parts.before}
      <a href={CROWDSOURCE_SITE_URL} target="_blank" rel="noreferrer" className="text-sky-400 underline">
        Crowdsource Choir
      </a>
      {parts.after}
    </p>
  );
}
