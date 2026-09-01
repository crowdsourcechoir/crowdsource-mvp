import { Suspense } from "react";
import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesQueuePage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Approval Queue</h1>
      <p className="mb-4 text-sm text-gray-400">
        Filter by sports, conferences, fundraisers, arts, entertainment, or tech. First-touch emails only.
      </p>
      <SalesSubNav />
      <Suspense fallback={<p className="text-gray-400">Loading queue…</p>}>
        <ApprovalQueueClient />
      </Suspense>
    </div>
  );
}
