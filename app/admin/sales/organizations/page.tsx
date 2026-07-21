import BatchRunClient from "@/components/sales/BatchRunClient";
import DiscoveryRunClient from "@/components/sales/DiscoveryRunClient";
import OrganizationsClient from "@/components/sales/OrganizationsClient";

export default function SalesOrganizationsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Organizations</h1>
      <DiscoveryRunClient />
      <BatchRunClient />
      <OrganizationsClient />
    </div>
  );
}
