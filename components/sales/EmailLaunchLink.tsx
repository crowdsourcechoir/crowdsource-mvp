"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyEmailToClipboard } from "@/lib/sales/outreach/mailto";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";

/**
 * Copy-only draft helper. Never opens mailto or sends — Joel browses and copies freely;
 * actual send is Approve → confirm → Gmail (or mailto only from that confirm click).
 */
export default function EmailLaunchLink({
  to,
  subject,
  body,
  className,
  label = "Copy draft (no send)",
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
    const cleanBody = stripEmailSignature(body);

    if (clearTimer.current) clearTimeout(clearTimer.current);

    copyEmailToClipboard(to, subject, cleanBody)
      .then(() => setStatus(`Copied for ${to} — not sent. Use Approve → confirm to send.`))
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
