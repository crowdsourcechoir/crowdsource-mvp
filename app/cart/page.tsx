import type { Metadata } from "next";
import { CartPage } from "@/components/choir-site/CartPage";
import { SiteFrame } from "@/components/choir-site/SiteFrame";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your Crowdsource Choir merch order.",
};

export default function Page() {
  return (
    <SiteFrame>
      <CartPage />
    </SiteFrame>
  );
}
