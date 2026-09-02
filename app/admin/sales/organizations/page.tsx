import BatchRunClient from "@/components/sales/BatchRunClient";
import DiscoveryRunClient from "@/components/sales/DiscoveryRunClient";
import FillQueueClient from "@/components/sales/FillQueueClient";
import OrganizationsClient from "@/components/sales/OrganizationsClient";
import { AddOrganizationLauncher } from "@/components/sales/AddOrganizationForm";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesOrganizationsPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Organizations</h1>
      <SalesSubNav />
      <div className="mb-4 flex justify-end">
        <AddOrganizationLauncher />
      </div>
      <FillQueueClient />
      <DiscoveryRunClient />
      <BatchRunClient />
      <OrganizationsClient />
    </div>
  );
}
