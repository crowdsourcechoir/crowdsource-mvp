"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { TodaySnapshot } from "@/lib/sales/today";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

type GmailStatus = {
  connected?: boolean;
  email?: string | null;
  configured?: boolean;
  sendsEnabled?: boolean;
};

function ActionCard({
  href,
  label,
  count,
  hint,
  primary,
}: {
  href: string;
  label: string;
  count: number;
  hint: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-5 transition hover:border-gray-500 ${
        primary ? "border-sky-700 bg-sky-950/30" : "border-gray-800 bg-gray-900/40"
      }`}
    >
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{count}</p>
      <p className="mt-2 text-sm text-gray-500">{hint}</p>
    </Link>
  );
}

function Pulse({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-600">{hint}</p> : null}
    </div>
  );
}

export default function SalesTodayClient() {
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/today", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load today"));
      const body = data as { snapshot?: TodaySnapshot; gmail?: GmailStatus };
      setSnapshot(body.snapshot ?? null);
      setGmail(body.gmail ?? null);
      setError(null);
    } catch (err) {
      setError(publicErrorMessage(err, "Failed to load today"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !snapshot) return <p className="text-gray-400">Loading today…</p>;
  if (error && !snapshot) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/40 p-6">
        <p className="text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-md border border-red-700 px-3 py-1.5 text-sm text-red-100 hover:bg-red-900/40"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!snapshot) return null;

  const followHint =
    snapshot.followUpDrafts > 0
      ? `${snapshot.followUpDrafts} nudge draft${snapshot.followUpDrafts === 1 ? "" : "s"} ready on Follow-ups`
      : "No-reply after 7 days — generate drafts on Follow-ups";

  return (
    <div>
      {gmail && !gmail.connected ? (
        <div className="mb-6 rounded-xl border border-amber-800 bg-amber-950/30 p-4">
          <p className="text-sm font-medium text-amber-200">Gmail is not connected — replies and in-thread follow-ups stay dark.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-100/90">
            <li>
              Click{" "}
              <a href="/api/sales/gmail/connect" className="underline">
                Connect Gmail
              </a>{" "}
              and finish Google consent for the inbox you send from.
            </li>
            <li>Back on this page, click <span className="font-medium">Resume sending</span>. Connect alone stays paused.</li>
            <li>Each email still needs Send → Yes, send now. Pause anytime without disconnecting.</li>
          </ol>
        </div>
      ) : null}

      {gmail?.connected && gmail.sendsEnabled === false ? (
        <div className="mb-6 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          Gmail is connected{gmail.email ? ` as ${gmail.email}` : ""} but sending is paused. Click Resume sending below
          when you want Queue Send to go out from that inbox.
        </div>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Do now</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ActionCard
          href="/admin/sales/funnel?focus=replies"
          label="Replies to handle"
          count={snapshot.replies}
          hint={
            gmail?.connected
              ? "Interest or inbound since last send"
              : "Connect Gmail to catch new replies automatically"
          }
          primary={snapshot.replies > 0}
        />
        <ActionCard
          href="/admin/sales/follow-ups"
          label="Follow-ups due"
          count={snapshot.followUpsDue}
          hint={followHint}
        />
        <ActionCard
          href="/admin/sales/queue"
          label="New to send"
          count={snapshot.newToSend}
          hint="First-touch drafts in Queue — same editor as always"
          primary={snapshot.replies === 0}
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">Pulse</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Pulse label="Sent (7 days)" value={snapshot.sentThisWeek} hint={`${snapshot.sentAllTime} all-time`} />
        <Pulse label="Awaiting reply" value={snapshot.awaitingReply} hint={`${snapshot.inFunnel} in funnel`} />
        <Pulse label="Replied" value={snapshot.replied} />
        <Pulse
          label="Won"
          value={snapshot.won}
          hint={snapshot.won === 0 ? "None yet — mark Won from Funnel when a deal closes" : undefined}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Needs attention</h2>
        {snapshot.hot.length === 0 ? (
          <p className="rounded-xl border border-gray-800 px-4 py-6 text-sm text-gray-500">
            No replies or Interest yet. Keep sending from Queue; this list fills when someone writes back.
          </p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
            {snapshot.hot.map((lead) => (
              <li key={lead.opportunityId}>
                <Link
                  href={`/admin/sales/opportunities/${lead.opportunityId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-900/60"
                >
                  <span>
                    <span className="block font-medium text-white">{lead.organizationName}</span>
                    <span className="block truncate text-xs text-gray-500">{lead.title}</span>
                  </span>
                  <span className="shrink-0 rounded-md border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
                    {lead.reason === "won" ? "Won" : lead.reason === "replied" ? "Replied" : "Interest"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
