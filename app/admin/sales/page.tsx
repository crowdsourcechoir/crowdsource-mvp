import { Suspense } from "react";
import SalesHomeClient from "@/components/sales/SalesHomeClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesOverviewPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Sales</h1>
      <p className="mb-4 text-sm text-gray-400">Search, find leads, and send from here. Queue is scored highest first.</p>
      <SalesSubNav />
      <Suspense fallback={<p className="text-gray-400">Loading…</p>}>
        <SalesHomeClient />
      </Suspense>
    </div>
  );
}
