import { Suspense } from "react";
import SalesHomeClient from "@/components/sales/SalesHomeClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesOverviewPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Sales</h1>
      <p className="mb-4 text-sm text-gray-400">
        Todos and the scored send queue. Search opens an organization. Find more like a good-fit role from the contact
        card, or from Organizations.
      </p>
      <SalesSubNav />
      <Suspense fallback={<p className="text-gray-400">Loading…</p>}>
        <SalesHomeClient />
      </Suspense>
    </div>
  );
}
