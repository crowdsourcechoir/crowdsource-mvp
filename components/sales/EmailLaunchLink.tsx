"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildMailtoUrl, copyEmailToClipboard, launchMailto } from "@/lib/sales/outreach/mailto";
import { emailBodyToHtml, ensureEmailSignature } from "@/lib/sales/outreach/signature";

/**
 * Standalone "Open in email client" trigger, shared between the approval queue and the single-
 * opportunity detail page. A single click both attempts the `mailto:` handoff AND copies the
 * draft to the clipboard as a fallback — see lib/sales/outreach/mailto.ts for why the fallback
 * matters (webmail providers like Gmail only catch `mailto:` in a browser that's been explicitly
 * granted handler permission there; otherwise the click does nothing visible at all).
 */
export default function EmailLaunchLink({
  to,
  subject,
  body,
  className,
  label = "Open in email client ↗",
}: {
  to: string;
  subject: string;
  body: string;
  className?: string;
  label?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    const signedBody = ensureEmailSignature(body);
    // Fire the mailto navigation synchronously, in the same click event, before touching the
    // clipboard API — same user-gesture reasoning as the approve flow in ApprovalQueueClient.
    launchMailto(buildMailtoUrl(to, subject, signedBody));

    if (clearTimer.current) clearTimeout(clearTimer.current);

    copyEmailToClipboard(to, subject, signedBody, emailBodyToHtml(signedBody))
      .then(() => setStatus(`Draft copied to clipboard — paste into a new email to ${to} if your mail client didn't open.`))
      .catch(() => setStatus("Couldn't copy the draft to your clipboard automatically."));

    clearTimer.current = setTimeout(() => setStatus(null), 6000);
  }, [to, subject, body]);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleClick} className={className ?? "text-xs text-sky-400 underline"}>
        {label}
      </button>
      {status && <span className="text-xs text-emerald-400">{status}</span>}
    </span>
  );
}
