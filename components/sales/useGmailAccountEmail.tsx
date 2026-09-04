"use client";

import { useEffect, useState } from "react";

let cachedEmail: string | null | undefined;
let inflight: Promise<string | null> | null = null;

async function loadEmail(): Promise<string | null> {
  if (cachedEmail !== undefined) return cachedEmail;
  if (!inflight) {
    inflight = fetch("/api/sales/gmail/status", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { email?: string | null };
        cachedEmail = typeof data.email === "string" && data.email.trim() ? data.email.trim() : null;
        return cachedEmail;
      })
      .catch(() => {
        cachedEmail = null;
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useGmailAccountEmail(): string | null {
  const [email, setEmail] = useState<string | null>(cachedEmail ?? null);
  useEffect(() => {
    void loadEmail().then(setEmail);
  }, []);
  return email;
}
