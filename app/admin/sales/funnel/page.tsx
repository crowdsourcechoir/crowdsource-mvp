import { Suspense } from "react";
import FunnelClient from "@/components/sales/FunnelClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesFunnelPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Funnel</h1>
      <p className="mb-4 text-sm text-gray-400">
        Everything approved out of the queue, tracked Awareness → Interest → Won (or Lost) after the email is launched.
      </p>
      <SalesSubNav />
      <Suspense fallback={<p className="text-gray-400">Loading funnel…</p>}>
        <FunnelClient />
      </Suspense>
    </div>
  );
}
