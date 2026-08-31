"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FunnelItemDetail, RelationshipStage } from "@/lib/sales/types";
import { isReplyFocusRow } from "@/lib/sales/funnel-focus";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import { gmailThreadUrl } from "@/lib/sales/gmail/constants";

export default function RepliesWorkPane() {
  const [items, setItems] = useState<FunnelItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/funnel", { cache: "no-store" });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load replies"));
      setItems((data as { items?: FunnelItemDetail[] }).items ?? []);
      setError(null);
    } catch (err) {
      setError(publicErrorMessage(err, "Failed to load replies"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replies = useMemo(() => items.filter(isReplyFocusRow), [items]);

  async function move(opportunityId: string, stage: RelationshipStage) {
    setItems((prev) =>
      prev.map((item) =>
        item.opportunity.id === opportunityId
          ? { ...item, opportunity: { ...item.opportunity, relationshipStage: stage } }
          : item
      )
    );
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move");
      void load();
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading replies…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (replies.length === 0) {
    return <p className="rounded-xl border border-gray-800 px-4 py-8 text-center text-sm text-gray-500">No replies waiting.</p>;
  }

  return (
    <ul className="space-y-2">
      {replies.map((item) => (
        <li key={item.opportunity.id} className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <Link href={`/admin/sales/opportunities/${item.opportunity.id}`} className="font-medium text-white hover:underline">
            {item.organization.name}
          </Link>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.contact?.fullName ?? "No contact"} {item.contact?.email ? `· ${item.contact.email}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.opportunity.gmailThreadId ? (
              <a
                href={gmailThreadUrl(item.opportunity.gmailThreadId)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 underline"
              >
                Open thread
              </a>
            ) : null}
            {item.opportunity.relationshipStage === "awareness" ? (
              <button
                type="button"
                onClick={() => void move(item.opportunity.id, "interest")}
                className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white"
              >
                Mark replied
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void move(item.opportunity.id, "purchase")}
                className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white"
              >
                Mark won
              </button>
            )}
            <button
              type="button"
              onClick={() => void move(item.opportunity.id, "lost")}
              className="rounded-md border border-red-900 px-2 py-1 text-xs text-red-300"
            >
              Lost
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
