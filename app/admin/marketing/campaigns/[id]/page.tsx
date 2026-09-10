import MarketingCampaignEditorClient from "@/components/marketing/MarketingCampaignEditorClient";

export default async function MarketingCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="w-full text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">Marketing</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Campaign</h1>
      </div>
      <MarketingCampaignEditorClient campaignId={id} />
    </div>
  );
}
