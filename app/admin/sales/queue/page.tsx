import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesQueuePage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Approval Queue</h1>
      <p className="mb-4 text-sm text-gray-400">
        Solid leads only — score ≥70 with a verified contact. Weaker scores stay out of this queue.
      </p>
      <SalesSubNav />
      <ApprovalQueueClient />
    </div>
  );
}
