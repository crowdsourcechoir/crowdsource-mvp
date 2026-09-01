import { Suspense } from "react";
import BatchRunClient from "@/components/sales/BatchRunClient";
import DiscoveryRunClient from "@/components/sales/DiscoveryRunClient";
import FillQueueClient from "@/components/sales/FillQueueClient";
import OrganizationsClient from "@/components/sales/OrganizationsClient";
import OrganizationsFindSection from "@/components/sales/OrganizationsFindSection";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesOrganizationsPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Organizations</h1>
      <p className="mb-4 text-sm text-gray-400">
        Leads folder — search, find a role at an org, or more like a contact that was a good fit. Never auto-sends.
      </p>
      <SalesSubNav />
      <Suspense fallback={<p className="mb-8 text-sm text-gray-500">Loading search…</p>}>
        <OrganizationsFindSection />
      </Suspense>
      <details className="mb-6 rounded-xl border border-gray-900">
        <summary className="cursor-pointer px-4 py-3 text-sm text-gray-500">Fill queue, discovery, batch run</summary>
        <div className="border-t border-gray-900 px-4 py-4">
          <FillQueueClient />
          <DiscoveryRunClient />
          <BatchRunClient />
        </div>
      </details>
      <OrganizationsClient />
    </div>
  );
}
