import type { Metadata } from "next";
import { InquiryForm } from "@/components/choir-site/InquiryForm";
import { SiteFrame } from "@/components/choir-site/SiteFrame";

export const metadata: Metadata = {
  title: "Inquiry",
  description: "Tell Crowdsource Choir about your gathering.",
};

export default function Page() {
  return (
    <SiteFrame>
      <InquiryForm />
    </SiteFrame>
  );
}
