"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney, products } from "@/lib/choir-site/catalog";

export function MerchGrid() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) => `${product.title} ${product.summary}`.toLowerCase().includes(needle));
  }, [query]);

  return (
    <section className="choir-section">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
        <h1 className="choir-display" style={{ fontSize: "clamp(3.5rem, 8vw, 6rem)", margin: 0 }}>
          Merch
        </h1>
        <label className="choir-field" style={{ minWidth: 220 }}>
          Filter
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merch" />
        </label>
      </div>
      {visible.length === 0 ? (
        <p>No results match your search. Try removing a few filters.</p>
      ) : (
        <div className="choir-grid" style={{ marginTop: "1.5rem" }}>
          {visible.map((product) => (
            <Link key={product.slug} className="choir-product" href={`/merch/p/${product.slug}`}>
              <div className="choir-product-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="primary" src={product.images[0]} alt={product.title} />
                {product.images[1] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="alt" src={product.images[1]} alt="" />
                ) : null}
              </div>
              <h2>{product.title}</h2>
              <p>{formatMoney(product.priceCents)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
