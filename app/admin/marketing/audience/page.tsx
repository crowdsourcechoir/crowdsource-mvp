import MarketingAudienceClient from "@/components/marketing/MarketingAudienceClient";

export default function MarketingAudiencePage() {
  return (
    <div className="w-full text-white">
      <div className="mb-3">
        <p className="csc-eyebrow">Marketing</p>
        <h1 className="mt-1 text-xl font-bold text-white">Audience</h1>
      </div>
      <MarketingAudienceClient />
    </div>
  );
}
