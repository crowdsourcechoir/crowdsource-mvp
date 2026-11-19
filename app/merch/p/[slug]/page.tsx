import type { Metadata } from "next";
import Link from "next/link";
import { ProductDetail } from "@/components/choir-site/ProductDetail";
import { SiteFrame } from "@/components/choir-site/SiteFrame";
import { formatMoney, productBySlug } from "@/lib/choir-site/catalog";

type Params = { slug: string };

export function generateMetadata({ params }: { params: Params }): Metadata {
  const product = productBySlug(params.slug);
  if (!product) return { title: "Merch" };
  return {
    title: product.title,
    description: `${product.summary} ${formatMoney(product.priceCents)}.`,
  };
}

export default function Page({ params }: { params: Params }) {
  const product = productBySlug(params.slug);
  if (!product) {
    return (
      <SiteFrame>
        <section className="choir-section">
          <h1 className="choir-display">That item isn’t in the shop</h1>
          <Link className="choir-btn" href="/merch">
            View all merch
          </Link>
        </section>
      </SiteFrame>
    );
  }
  return (
    <SiteFrame>
      <ProductDetail product={product} />
    </SiteFrame>
  );
}
