"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyEmailToClipboard } from "@/lib/sales/outreach/mailto";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";

/** Copy-only. Icon, not words. Never sends. */
export default function EmailLaunchLink({
  to,
  subject,
  body,
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
      .then(() => setStatus("Copied — not sent"))
      .catch(() => setStatus("Copy failed"));
    clearTimer.current = setTimeout(() => setStatus(null), 4000);
  }, [to, subject, body]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        title="Copy draft (does not send)"
        aria-label="Copy draft"
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </button>
      {status && <span className="text-xs text-emerald-400">{status}</span>}
    </span>
  );
}
