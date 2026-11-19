import type { Metadata } from "next";
import { BookPage } from "@/components/choir-site/BookPage";
import { SiteFrame } from "@/components/choir-site/SiteFrame";

export const metadata: Metadata = {
  title: "Book",
  description: "Book Crowdsource Choir for a participatory, co-created live music experience.",
};

export default function Page() {
  return (
    <SiteFrame>
      <BookPage />
    </SiteFrame>
  );
}
