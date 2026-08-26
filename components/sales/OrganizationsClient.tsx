"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Organization, OrganizationType } from "@/lib/sales/types";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

export default function OrganizationsClient() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [types, setTypes] = useState<OrganizationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/organizations${q ? `?search=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load organizations"));
      const body = data as { organizations?: Organization[]; organizationTypes?: OrganizationType[] };
      setOrganizations(body.organizations ?? []);
      setTypes(body.organizationTypes ?? []);
      setError(null);
    } catch (err) {
      setError(publicErrorMessage(err, "Failed to load organizations"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const typeLabel = (id: string | null) => types.find((t) => t.id === id)?.label ?? "Unclassified";

  async function addOrganization(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/sales/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), websiteUrl: newWebsite.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add organization");
      setNewName("");
      setNewWebsite("");
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add organization");
    } finally {
      setAdding(false);
    }
  }

  async function runPipeline(orgId: string) {
    setRunningId(orgId);
    setRunResult((prev) => ({ ...prev, [orgId]: "Running…" }));
    try {
      const res = await fetch("/api/sales/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pipeline run failed");
      const message =
        data.summary.status === "skipped_existing_client"
          ? "Skipped — marked as an existing client."
          : `Status: ${data.summary.status} (${data.summary.opportunityIds.length} opportunities)`;
      setRunResult((prev) => ({ ...prev, [orgId]: message }));
    } catch (err) {
      setRunResult((prev) => ({ ...prev, [orgId]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div>
      <form onSubmit={addOrganization} className="mb-6 flex flex-wrap gap-2 rounded-xl border border-gray-800 p-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Organization name"
          className="min-w-[220px] flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
        />
        <input
          value={newWebsite}
          onChange={(e) => setNewWebsite(e.target.value)}
          placeholder="Website URL (optional)"
          className="min-w-[220px] flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
        />
        <button disabled={adding} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50">
          {adding ? "Adding…" : "Add organization"}
        </button>
      </form>

      <div className="mb-4 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          placeholder="Search organizations…"
          className="w-64 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
        />
        <button onClick={() => load(search)} className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">
          Search
        </button>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}
      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : organizations.length === 0 ? (
        <p className="text-gray-400">No organizations yet. Add one above, or run the import scripts — see docs/sales-platform/data-import.md.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Pipeline</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id} className="border-b border-gray-800 text-gray-200">
                  <td className="px-4 py-3">
                    <Link href={`/admin/sales/organizations/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    {org.isExistingClient && (
                      <span className="ml-2 rounded-full border border-emerald-700 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        Existing client
                      </span>
                    )}
                    {org.websiteUrl && <div className="text-xs text-gray-500">{org.domain}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{typeLabel(org.organizationTypeId)}</td>
                  <td className="px-4 py-3 text-gray-400">{org.source}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{runResult[org.id] ?? ""}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => runPipeline(org.id)}
                      disabled={runningId === org.id}
                      className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {runningId === org.id ? "Running…" : "Run pipeline"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
