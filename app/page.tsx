import type { Metadata } from "next";
import { headers } from "next/headers";
import HomePageGate from "./HomePageGate";
import { MarketingHome } from "@/components/choir-site/MarketingHome";
import { SiteFrame } from "@/components/choir-site/SiteFrame";
import { showsOperatorHome } from "@/lib/choir-site/host";

const description = "Crowd-driven live music. Transforming audiences into creators through collective anthemic experiences.";

export function generateMetadata({ searchParams }: { searchParams?: { choir?: string } }): Metadata {
  const host = headers().get("x-forwarded-host") || headers().get("host");
  if (showsOperatorHome(host) && searchParams?.choir !== "1") return { title: "Crowdsource Choir" };
  return {
    title: "Crowdsource Choir",
    description,
    openGraph: { title: "Crowdsource Choir", description, url: "https://www.crowdsourcechoir.com" },
  };
}

export default function HomePage({ searchParams }: { searchParams?: { choir?: string } }) {
  const host = headers().get("x-forwarded-host") || headers().get("host");
  if (showsOperatorHome(host) && searchParams?.choir !== "1") return <HomePageGate />;
  return (
    <SiteFrame>
      <MarketingHome />
    </SiteFrame>
  );
}
