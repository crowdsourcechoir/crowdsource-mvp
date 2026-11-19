"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney, type ChoirProduct } from "@/lib/choir-site/catalog";
import { useCart } from "./useCart";

export function ProductDetail({ product }: { product: ChoirProduct }) {
  const { add } = useCart();
  const [color, setColor] = useState(product.colors[0] || "");
  const [size, setSize] = useState(product.sizes[0] || "");
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [added, setAdded] = useState(false);

  return (
    <section className="choir-section choir-split">
      <div className="choir-gallery">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.images[photo] || product.images[0]} alt={product.title} />
        {product.images.length > 1 ? (
          <div className="choir-thumbs">
            {product.images.map((image, index) => (
              <button key={image} type="button" aria-current={index === photo} aria-label={`Photo ${index + 1}`} onClick={() => setPhoto(index)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <h1 className="choir-display" style={{ fontSize: "clamp(2.8rem, 6vw, 4.5rem)" }}>
          {product.title}
        </h1>
        <p>{formatMoney(product.priceCents)}</p>
        <p>{product.summary}</p>
        <ul>
          {product.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
        <form
          className="choir-form"
          onSubmit={(event) => {
            event.preventDefault();
            add({ slug: product.slug, color, size, qty });
            setAdded(true);
          }}
        >
          <label className="choir-field">
            Color
            <select value={color} onChange={(event) => setColor(event.target.value)} aria-label="Select color">
              {product.colors.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="choir-field">
            Size
            <select value={size} onChange={(event) => setSize(event.target.value)} aria-label="Select size">
              {product.sizes.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <div className="choir-qty" aria-label="Quantity">
            <button type="button" aria-label="Decrease quantity by 1" onClick={() => setQty((value) => Math.max(1, value - 1))}>
              −
            </button>
            <input
              aria-label="Quantity"
              inputMode="numeric"
              value={qty}
              onChange={(event) => setQty(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
            />
            <button type="button" aria-label="Increase quantity by 1" onClick={() => setQty((value) => Math.min(20, value + 1))}>
              +
            </button>
          </div>
          <button className="choir-btn" type="submit">
            Add to cart
          </button>
          {added ? (
            <p>
              Added. <Link href="/cart">View cart</Link>
            </p>
          ) : null}
        </form>
        <p>
          <Link href="/merch">View all merch</Link>
        </p>
      </div>
    </section>
  );
}
