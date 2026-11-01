import type { Metadata } from "next";
import SubscribeForm from "@/components/marketing/SubscribeForm";

export const metadata: Metadata = {
  title: "Join the list",
  description: "Get Crowdsource Choir emails.",
};

export default function SubscribePage() {
  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white">
      <div className="mx-auto max-w-lg">
        <SubscribeForm />
      </div>
    </main>
  );
}
