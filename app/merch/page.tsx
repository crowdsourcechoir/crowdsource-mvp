import type { Metadata } from "next";
import { MerchGrid } from "@/components/choir-site/MerchGrid";
import { SiteFrame } from "@/components/choir-site/SiteFrame";

export const metadata: Metadata = {
  title: "Merch",
  description: "Crowdsource Choir caps, tees, sweats, and joggers.",
};

export default function Page() {
  return (
    <SiteFrame>
      <MerchGrid />
    </SiteFrame>
  );
}
