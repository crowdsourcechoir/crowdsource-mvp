import { Suspense } from "react";
import FunnelClient from "@/components/sales/FunnelClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesFunnelPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Funnel</h1>
      <p className="mb-4 text-sm text-gray-400">
        Daily view is Needs attention (replies, Interest, due follow-ups). Open All for the four-column board.
      </p>
      <SalesSubNav />
      <Suspense fallback={<p className="text-gray-400">Loading funnel…</p>}>
        <FunnelClient />
      </Suspense>
    </div>
  );
}
