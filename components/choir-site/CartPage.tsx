"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { formatMoney, productBySlug } from "@/lib/choir-site/catalog";
import { cartSubtotal, lineKey } from "@/lib/choir-site/cart";
import { useCart } from "./useCart";

export function CartPage() {
  const { lines, ready, update, clear } = useCart();
  const [state, setState] = useState<"idle" | "sending" | "done" | "draft">("idle");
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");
  const total = cartSubtotal(lines);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("sending");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/choir/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        address: form.get("address"),
        city: form.get("city"),
        region: form.get("region"),
        postal: form.get("postal"),
        notes: form.get("notes"),
        lines,
        company_website: form.get("company_website"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      setError(data.error || "Could not place the order.");
      return;
    }
    if (data.delivered) {
      clear();
      setState("done");
      return;
    }
    setMailto(typeof data.mailto === "string" ? data.mailto : "");
    setState("draft");
  }

  if (!ready) return <section className="choir-section"><p>Loading cart…</p></section>;

  if (state === "done") {
    return (
      <section className="choir-section" style={{ maxWidth: 720 }}>
        <h1 className="choir-display">Order received</h1>
        <p>We’ll email you to confirm payment and shipping. Nothing has been charged yet.</p>
        <Link className="choir-btn" href="/merch">Keep browsing</Link>
      </section>
    );
  }

  return (
    <section className="choir-section">
      <h1 className="choir-display" style={{ fontSize: "clamp(3.5rem, 8vw, 6rem)", marginTop: 0 }}>Cart</h1>
      {lines.length === 0 ? (
        <p>
          Your cart is empty. <Link href="/merch">View merch</Link>
        </p>
      ) : (
        <div className="choir-split">
          <div>
            {lines.map((line) => {
              const product = productBySlug(line.slug);
              const key = lineKey(line);
              return (
                <article key={key} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                  {product ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.images[0]} alt="" style={{ width: 96, height: 96, objectFit: "cover" }} />
                  ) : null}
                  <div>
                    <h2 style={{ fontSize: "1rem", margin: "0 0 0.3rem" }}>{product?.title || line.slug}</h2>
                    <p style={{ margin: 0 }}>
                      {line.color} · {line.size}
                      {product ? ` · ${formatMoney(product.priceCents)}` : ""}
                    </p>
                    <div className="choir-qty">
                      <button type="button" aria-label={`Decrease ${product?.title || "item"}`} onClick={() => update(key, line.qty - 1)}>
                        −
                      </button>
                      <input aria-label="Quantity" value={line.qty} readOnly />
                      <button type="button" aria-label={`Increase ${product?.title || "item"}`} onClick={() => update(key, line.qty + 1)}>
                        +
                      </button>
                    </div>
                    <button type="button" className="choir-btn" onClick={() => update(key, 0)}>
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
            <p>Subtotal {formatMoney(total)}</p>
            <p>We’ll reply with payment and shipping. Card checkout is not taken on this page.</p>
          </div>
          <form className="choir-form" onSubmit={onSubmit}>
            <h2 className="choir-display" style={{ fontSize: "2.4rem", margin: 0 }}>Send this order</h2>
            <label className="choir-honeypot">
              Company
              <input name="company_website" tabIndex={-1} autoComplete="off" />
            </label>
            <label className="choir-field">
              Name
              <input name="name" required autoComplete="name" />
            </label>
            <label className="choir-field">
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label className="choir-field">
              Phone
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label className="choir-field">
              Address
              <input name="address" required autoComplete="street-address" />
            </label>
            <div className="choir-form-row">
              <label className="choir-field">
                City
                <input name="city" required autoComplete="address-level2" />
              </label>
              <label className="choir-field">
                State
                <input name="region" autoComplete="address-level1" />
              </label>
            </div>
            <label className="choir-field">
              ZIP
              <input name="postal" autoComplete="postal-code" />
            </label>
            <label className="choir-field">
              Notes
              <textarea name="notes" rows={3} />
            </label>
            {error ? <p>{error}</p> : null}
            {state === "draft" ? (
              <p>
                Mail isn’t connected on this server yet. <a href={mailto}>Email the order</a> and we’ll fulfill it.
              </p>
            ) : null}
            <button className="choir-btn" type="submit" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Place order"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
