"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildMailtoUrl, copyEmailToClipboard, launchMailto } from "@/lib/sales/outreach/mailto";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";

/**
 * Fallback "copy / open mailto" trigger when Gmail API isn't connected. Approve & send in the
 * queue is the primary path once Gmail is linked.
 */
export default function EmailLaunchLink({
  to,
  subject,
  body,
  className,
  label = "Copy draft / mailto fallback ↗",
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
    // Strip any previously embedded press-quote block — Gmail appends Joel's signature itself.
    const cleanBody = stripEmailSignature(body);
    launchMailto(buildMailtoUrl(to, subject, cleanBody));

    if (clearTimer.current) clearTimeout(clearTimer.current);

    copyEmailToClipboard(to, subject, cleanBody)
      .then(() => setStatus(`Draft copied — paste into a new email to ${to} if needed.`))
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
