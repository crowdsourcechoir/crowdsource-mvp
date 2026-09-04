"use client";

import type { ReactNode } from "react";
import { gmailThreadUrl } from "@/lib/sales/gmail/constants";
import { useGmailAccountEmail } from "@/components/sales/useGmailAccountEmail";

export default function GmailThreadLink({
  threadId,
  accountEmail,
  className,
  children,
}: {
  threadId: string;
  accountEmail?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const fetched = useGmailAccountEmail();
  const email = accountEmail?.trim() || fetched;
  return (
    <a
      href={gmailThreadUrl(threadId, email)}
      target="_blank"
      rel="noreferrer"
      className={className ?? "text-sm text-sky-400 hover:underline"}
    >
      {children ?? "Open this thread →"}
    </a>
  );
}
