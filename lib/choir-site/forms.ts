import { productBySlug } from "./catalog";
import { cartSubtotal, isCartLine, variantExists, type CartLine } from "./cart";

export const PLANNING_OPTIONS = [
  "Corporate / Team Offsite",
  "Conference / Event",
  "Private Celebration",
  "Community Event",
  "Not sure yet",
] as const;

export const GROUP_SIZES = ["Less than 50", "50-100", "100-250", "250+"] as const;

export const INVESTMENT_OPTIONS = ["$5,000–$10,000", "$10,000-20,000", "$20,000+", "Not sure yet"] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InquiryInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  planning: string;
  groupSize: string;
  location: string;
  date: string;
  investment: string[];
  about: string;
};

export type SubscribeInput = {
  name: string;
  email: string;
  city: string;
  note: string;
};

export type OrderInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  postal: string;
  notes: string;
  lines: CartLine[];
};

export function validateInquiry(body: unknown): { ok: true; value: InquiryInput; spam: boolean } | { ok: false; error: string } {
  const record = asRecord(body);
  if (!record) return { ok: false, error: "Invalid request" };
  if (honeypot(record)) return { ok: true, spam: true, value: emptyInquiry() };
  const firstName = text(record.firstName, 80);
  const lastName = text(record.lastName, 80);
  const email = text(record.email, 200);
  if (!firstName || !lastName) return { ok: false, error: "Enter your first and last name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  const planning = text(record.planning, 80);
  const groupSize = text(record.groupSize, 40);
  if (planning && !PLANNING_OPTIONS.includes(planning as (typeof PLANNING_OPTIONS)[number])) {
    return { ok: false, error: "Choose a gathering type from the list." };
  }
  if (groupSize && !GROUP_SIZES.includes(groupSize as (typeof GROUP_SIZES)[number])) {
    return { ok: false, error: "Choose a group size from the list." };
  }
  const investment = stringList(record.investment).filter((item) =>
    INVESTMENT_OPTIONS.includes(item as (typeof INVESTMENT_OPTIONS)[number])
  );
  return {
    ok: true,
    spam: false,
    value: {
      firstName,
      lastName,
      email,
      phone: text(record.phone, 40),
      planning,
      groupSize,
      location: text(record.location, 160),
      date: text(record.date, 40),
      investment,
      about: text(record.about, 4000),
    },
  };
}

export function validateSubscribe(body: unknown): { ok: true; value: SubscribeInput; spam: boolean } | { ok: false; error: string } {
  const record = asRecord(body);
  if (!record) return { ok: false, error: "Invalid request" };
  if (honeypot(record)) return { ok: true, spam: true, value: { name: "", email: "", city: "", note: "" } };
  const email = text(record.email, 200);
  const name = text(record.name, 120);
  if (!name) return { ok: false, error: "Enter your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  return {
    ok: true,
    spam: false,
    value: { name, email, city: text(record.city, 80), note: text(record.note, 1000) },
  };
}

export function validateOrder(body: unknown): { ok: true; value: OrderInput; totalCents: number; spam: boolean } | { ok: false; error: string } {
  const record = asRecord(body);
  if (!record) return { ok: false, error: "Invalid request" };
  if (honeypot(record)) return { ok: true, spam: true, totalCents: 0, value: emptyOrder() };
  const name = text(record.name, 120);
  const email = text(record.email, 200);
  const address = text(record.address, 200);
  const city = text(record.city, 80);
  if (!name) return { ok: false, error: "Enter your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!address || !city) return { ok: false, error: "Enter a shipping address and city." };
  if (!Array.isArray(record.lines) || record.lines.length === 0 || record.lines.length > 30) {
    return { ok: false, error: "Your cart is empty." };
  }
  const lines: CartLine[] = [];
  for (const raw of record.lines) {
    if (!isCartLine(raw)) return { ok: false, error: "A cart item is incomplete." };
    const product = productBySlug(raw.slug);
    if (!product || !variantExists(product, raw)) return { ok: false, error: "A cart item is no longer available." };
    lines.push({ slug: raw.slug, color: raw.color, size: raw.size, qty: raw.qty });
  }
  return {
    ok: true,
    spam: false,
    totalCents: cartSubtotal(lines),
    value: {
      name,
      email,
      phone: text(record.phone, 40),
      address,
      city,
      region: text(record.region, 40),
      postal: text(record.postal, 20),
      notes: text(record.notes, 2000),
      lines,
    },
  };
}

export function inquiryText(value: InquiryInput): string {
  return [
    "New booking inquiry",
    "",
    `Name: ${value.firstName} ${value.lastName}`,
    `Email: ${value.email}`,
    `Phone: ${value.phone || "—"}`,
    `Planning: ${value.planning || "—"}`,
    `Group size: ${value.groupSize || "—"}`,
    `Location: ${value.location || "—"}`,
    `Date: ${value.date || "—"}`,
    `Investment: ${value.investment.join(", ") || "—"}`,
    "",
    value.about || "(no note)",
  ].join("\n");
}

export function orderText(value: OrderInput, totalCents: number): string {
  const lines = value.lines.map((line) => {
    const product = productBySlug(line.slug);
    const title = product?.title || line.slug;
    const each = product ? (product.priceCents / 100).toFixed(2) : "?";
    return `- ${line.qty} × ${title} (${line.color}, ${line.size}) @ $${each}`;
  });
  return [
    "New merch order request",
    "",
    ...lines,
    "",
    `Subtotal: $${(totalCents / 100).toFixed(2)}`,
    "Payment is not captured here. Reply to confirm payment and shipping.",
    "",
    `Name: ${value.name}`,
    `Email: ${value.email}`,
    `Phone: ${value.phone || "—"}`,
    `Address: ${value.address}`,
    `${value.city}, ${value.region} ${value.postal}`.trim(),
    "",
    value.notes || "(no note)",
  ].join("\n");
}

export function subscribeText(value: SubscribeInput): string {
  return [`New choir list signup`, "", `Name: ${value.name}`, `Email: ${value.email}`, `City: ${value.city || "—"}`, "", value.note || "(no note)"].join("\n");
}

function emptyInquiry(): InquiryInput {
  return { firstName: "", lastName: "", email: "", phone: "", planning: "", groupSize: "", location: "", date: "", investment: [], about: "" };
}

function emptyOrder(): OrderInput {
  return { name: "", email: "", phone: "", address: "", city: "", region: "", postal: "", notes: "", lines: [] };
}

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function honeypot(record: Record<string, unknown>): boolean {
  return typeof record.company_website === "string" && record.company_website.trim().length > 0;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).slice(0, 8);
}
