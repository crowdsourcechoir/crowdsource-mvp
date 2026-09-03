import SalesOverviewClient from "@/components/sales/SalesOverviewClient";
import DigestClient from "@/components/sales/DigestClient";
import GmailConnectClient from "@/components/sales/GmailConnectClient";
import EnrichmentConfigClient from "@/components/sales/EnrichmentConfigClient";
import { AddOrganizationLauncher } from "@/components/sales/AddOrganizationForm";

export default function SalesOverviewPage() {
  return (
    <div className="w-full text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Prospecting Intelligence
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Sales</h1>
        <p className="mt-2 text-sm text-gray-400">
          AI-assisted prospecting — discover, research, score, and prepare outreach for human approval.
        </p>
      </div>

      <div className="mb-6 flex justify-end">
        <AddOrganizationLauncher />
      </div>

      <SalesOverviewClient />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <EnrichmentConfigClient />
        <GmailConnectClient />
        <DigestClient />
      </div>
    </div>
  );
}
