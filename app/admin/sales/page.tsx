import SalesOverviewClient from "@/components/sales/SalesOverviewClient";
import SalesFirstTouchClient from "@/components/sales/SalesFirstTouchClient";
import DigestClient from "@/components/sales/DigestClient";
import GmailConnectClient from "@/components/sales/GmailConnectClient";
import EnrichmentConfigClient from "@/components/sales/EnrichmentConfigClient";
import { AddOrganizationLauncher } from "@/components/sales/AddOrganizationForm";

export default function SalesOverviewPage() {
  return (
    <div className="w-full text-white">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
            Prospecting Intelligence
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Sales</h1>
          <p className="mt-2 text-sm text-gray-400">Dashboard — queue, funnel, wins, and this week’s outreach.</p>
        </div>
        <AddOrganizationLauncher />
      </div>

      <SalesOverviewClient />
      <SalesFirstTouchClient />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <EnrichmentConfigClient />
        <GmailConnectClient />
        <DigestClient />
      </div>
    </div>
  );
}
