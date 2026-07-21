import ApprovalQueueClient from "@/components/sales/ApprovalQueueClient";

export default function SalesQueuePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Approval Queue</h1>
      <ApprovalQueueClient />
    </div>
  );
}
