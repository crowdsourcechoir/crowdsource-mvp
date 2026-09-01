"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Organization } from "@/lib/sales/types";
import type { FindLeadsAction } from "@/lib/sales/find-leads";
import { readApiJson } from "@/lib/sales/http-error";
import OrgSearchBar from "@/components/sales/OrgSearchBar";
import FindLeadsPanel from "@/components/sales/FindLeadsPanel";

function parseFindAction(value: string | null): FindLeadsAction | undefined {
  if (value === "contact" || value === "similar" || value === "discover" || value === "fill_queue") return value;
  return undefined;
}

export default function OrganizationsFindSection() {
  const searchParams = useSearchParams();
  const initialAction = parseFindAction(searchParams.get("find"));
  const orgId = searchParams.get("orgId");
  const initialRole = searchParams.get("role")?.trim() || undefined;
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/sales/organizations/${orgId}`, { cache: "no-store" });
        const data = await readApiJson(res);
        if (!res.ok || cancelled) return;
        const next = (data as { organization?: Organization }).organization;
        if (next) setOrg(next);
      } catch {
        /* search bar still works if this org id is stale */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <div className="mb-8">
      <OrgSearchBar selected={org} onSelect={setOrg} />
      {initialAction === "similar" && (org || initialRole) ? (
        <p className="mt-3 text-xs text-sky-300">
          More like {org?.name ?? "this org"}
          {initialRole ? ` — ${initialRole}` : ""}. Run when you want discovery to start.
        </p>
      ) : null}
      <div className="mt-4 max-w-xl">
        <FindLeadsPanel organization={org} initialAction={initialAction} initialRole={initialRole} />
      </div>
    </div>
  );
}
