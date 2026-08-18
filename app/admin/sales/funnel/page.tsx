import FunnelClient from "@/components/sales/FunnelClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesFunnelPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Funnel</h1>
      <p className="mb-4 text-sm text-gray-400">
        Everything approved out of the queue, tracked Awareness → Interest → Purchase. Search finds funnel cards and the
        wider organization database. Schedule follow-ups on any card (or let reply sync prefill “in a few months”).
      </p>
      <SalesSubNav />
      <FunnelClient />
    </div>
  );
}
