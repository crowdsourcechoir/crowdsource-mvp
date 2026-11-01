import MarketingPersonClient from "@/components/marketing/MarketingPersonClient";

export default async function MarketingPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="w-full text-white">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">Marketing</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Person</h1>
      </div>
      <MarketingPersonClient personId={id} />
    </div>
  );
}
