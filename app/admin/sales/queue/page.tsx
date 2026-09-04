import { Suspense } from "react";
import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";
import FillQueueClient from "@/components/sales/FillQueueClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesQueuePage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Queue</h1>
      <p className="mb-4 text-sm text-gray-400">
        Send first emails, follow up on replies, and search any org you’ve already touched.
      </p>
      <SalesSubNav />
      <FillQueueClient variant="compact" />
      <Suspense fallback={<p className="text-gray-400">Loading queue…</p>}>
        <ApprovalQueueClient />
      </Suspense>
    </div>
  );
}
