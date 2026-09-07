import FunnelClient from "@/components/sales/FunnelClient";

export default function SalesFunnelPage() {
  return (
    <div className="w-full text-white">
      <div className="mb-6">
        <p className="csc-eyebrow">Prospecting</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Funnel</h1>
        <p className="mt-2 text-sm text-gray-400">
          Awareness → Interest → Won after email is launched. Stages also live on each org in the queue.
        </p>
      </div>
      <FunnelClient />
    </div>
  );
}
