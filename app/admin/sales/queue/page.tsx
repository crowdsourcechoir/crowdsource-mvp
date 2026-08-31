import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesQueuePage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Approval Queue</h1>
      <p className="mb-4 text-sm text-gray-400">
        First-touch emails only. Day-7 / day-14 nudges live on Follow-ups. Send still needs Yes, send now.
      </p>
      <SalesSubNav />
      <ApprovalQueueClient />
    </div>
  );
}
