"use client";

import type { ReactNode } from "react";
import { gmailThreadUrl } from "@/lib/sales/gmail/constants";
import { useGmailAccountEmail } from "@/components/sales/useGmailAccountEmail";

export default function GmailThreadLink({
  threadId,
  messageId,
  className,
  children,
}: {
  threadId: string;
  messageId?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const email = useGmailAccountEmail();
  return (
    <a
      href={gmailThreadUrl(threadId, email, messageId)}
      target="_blank"
      rel="noreferrer"
      className={className ?? "text-sm text-sky-400 hover:underline"}
    >
      {children ?? "Open this thread →"}
    </a>
  );
}
