import OpportunityDetailClient from "@/components/sales/OpportunityDetailClient";

export default async function SalesOpportunityDetailPage({ params }: { params: Promise<{ oppId: string }> }) {
  const { oppId } = await params;
  return <OpportunityDetailClient opportunityId={oppId} />;
}
