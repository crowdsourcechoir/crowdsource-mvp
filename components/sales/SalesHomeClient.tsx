"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { TodaySnapshot } from "@/lib/sales/today";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import OrgSearchBar from "@/components/sales/OrgSearchBar";
import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";
import FollowUpsClient from "@/components/sales/FollowUpsClient";
import RepliesWorkPane from "@/components/sales/RepliesWorkPane";
import GmailConnectClient from "@/components/sales/GmailConnectClient";
import EnrichmentConfigClient from "@/components/sales/EnrichmentConfigClient";
import DigestClient from "@/components/sales/DigestClient";

type WorkView = "send" | "followups" | "replies";

type GmailStatus = {
  connected?: boolean;
  email?: string | null;
  configured?: boolean;
  sendsEnabled?: boolean;
};

function parseWork(value: string | null): WorkView {
  if (value === "followups" || value === "replies") return value;
  return "send";
}

export default function SalesHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workParam = searchParams.get("work");
  const work = parseWork(workParam);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/today", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load dashboard"));
      const body = data as { snapshot?: TodaySnapshot; gmail?: GmailStatus };
      setSnapshot(body.snapshot ?? null);
      setGmail(body.gmail ?? null);
      setError(null);
    } catch (err) {
      setError(publicErrorMessage(err, "Failed to load dashboard"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setWork(next: WorkView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("work", next);
    router.replace(`/admin/sales?${params.toString()}`, { scroll: false });
  }

  const todos: { id: WorkView; label: string; count: number }[] = [
    { id: "replies", label: "Replies", count: snapshot?.replies ?? 0 },
    { id: "followups", label: "Follow-ups", count: snapshot?.followUpsDue ?? 0 },
    { id: "send", label: "To send", count: snapshot?.newToSend ?? 0 },
  ];

  return (
    <div>
      <div className="mb-6">
        <OrgSearchBar
          selected={null}
          onSelect={(next) => {
            if (next) router.push(`/admin/sales/organizations/${next.id}`);
          }}
        />
      </div>

      {gmail && !gmail.connected ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          <p>Gmail is disconnected. Connect, then Resume sending. Each email still needs Yes, send now.</p>
          <a href="/api/sales/gmail/connect" className="rounded-lg bg-amber-200 px-3 py-1.5 text-sm font-medium text-amber-950">
            Connect Gmail
          </a>
        </div>
      ) : null}

      {error && !/database not configured/i.test(error) ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {todos.map((todo) => {
          const active = work === todo.id;
          return (
            <button
              key={todo.id}
              type="button"
              onClick={() => setWork(todo.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                active ? "bg-white text-gray-900" : "border border-gray-800 text-gray-300 hover:border-gray-600"
              }`}
            >
              {todo.label}
              <span className={`ml-2 ${active ? "text-gray-500" : "text-gray-500"}`}>{todo.count}</span>
            </button>
          );
        })}
        {snapshot ? (
          <span className="self-center text-xs text-gray-600">
            {snapshot.awaitingReply} awaiting · {snapshot.won} won
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {work === "send" ? "Send queue" : work === "followups" ? "Follow-ups" : "Replies"}
          </h2>
          {work === "send" ? (
            <Link href="/admin/sales/queue" className="text-xs text-gray-600 underline">
              Full queue
            </Link>
          ) : work === "followups" ? (
            <Link href="/admin/sales/follow-ups" className="text-xs text-gray-600 underline">
              Full follow-ups
            </Link>
          ) : (
            <Link href="/admin/sales/funnel" className="text-xs text-gray-600 underline">
              Funnel board
            </Link>
          )}
        </div>
        {work === "send" ? <ApprovalQueueClient /> : null}
        {work === "followups" ? <FollowUpsClient /> : null}
        {work === "replies" ? <RepliesWorkPane /> : null}
      </div>

      <details className="mt-12 rounded-xl border border-gray-900">
        <summary className="cursor-pointer px-4 py-3 text-sm text-gray-500">Gmail, Hunter, digest</summary>
        <div className="border-t border-gray-900 px-4 py-4">
          <GmailConnectClient />
          <div className="mt-6">
            <EnrichmentConfigClient />
          </div>
          <div className="mt-6">
            <DigestClient />
          </div>
        </div>
      </details>
    </div>
  );
}
