import { Suspense } from "react";
import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";

export default function SalesQueuePage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading queue…</p>}>
      <ApprovalQueueClient />
    </Suspense>
  );
}
