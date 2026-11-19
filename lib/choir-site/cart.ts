import { productBySlug, type ChoirProduct } from "./catalog";

export const CART_KEY = "csc-choir-cart";

export type CartLine = {
  slug: string;
  color: string;
  size: string;
  qty: number;
};

export function lineKey(line: Pick<CartLine, "slug" | "color" | "size">): string {
  return `${line.slug}|${line.color}|${line.size}`;
}

export function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as CartLine;
  return (
    typeof line.slug === "string" &&
    typeof line.color === "string" &&
    typeof line.size === "string" &&
    Number.isInteger(line.qty) &&
    line.qty > 0 &&
    line.qty <= 20
  );
}

export function addLine(lines: CartLine[], next: CartLine): CartLine[] {
  const key = lineKey(next);
  const existing = lines.find((line) => lineKey(line) === key);
  if (!existing) return [...lines, { ...next, qty: clampQty(next.qty) }];
  return lines.map((line) =>
    lineKey(line) === key ? { ...line, qty: clampQty(line.qty + next.qty) } : line
  );
}

export function setLineQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  if (qty <= 0) return lines.filter((line) => lineKey(line) !== key);
  return lines.map((line) => (lineKey(line) === key ? { ...line, qty: clampQty(qty) } : line));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => {
    const product = productBySlug(line.slug);
    if (!product || !variantExists(product, line)) return sum;
    return sum + product.priceCents * line.qty;
  }, 0);
}

export function variantExists(product: ChoirProduct, line: Pick<CartLine, "color" | "size">): boolean {
  return product.colors.includes(line.color) && product.sizes.includes(line.size);
}

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(20, Math.round(qty)));
}
