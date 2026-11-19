import type { Metadata } from "next";
import { AboutPage } from "@/components/choir-site/AboutPage";
import { SiteFrame } from "@/components/choir-site/SiteFrame";

export const metadata: Metadata = {
  title: "About",
  description: "How Crowdsource Choir began, and the people who guide the room.",
};

export default function Page() {
  return (
    <SiteFrame>
      <AboutPage />
    </SiteFrame>
  );
}
