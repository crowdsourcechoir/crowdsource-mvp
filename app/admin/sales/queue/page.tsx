import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesQueuePage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Approval Queue</h1>
      <SalesSubNav />
      <ApprovalQueueClient />
    </div>
  );
}
