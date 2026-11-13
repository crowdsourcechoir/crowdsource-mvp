import assert from "node:assert/strict";
import { showsOperatorHome } from "./host";
import { addLine, cartSubtotal, lineKey } from "./cart";
import { validateInquiry, validateOrder } from "./forms";
import { decideAccess } from "../operators/access";

assert.equal(showsOperatorHome("app.crowdsourcechoir.com"), true);
assert.equal(showsOperatorHome("localhost:3000"), true);
assert.equal(showsOperatorHome("www.crowdsourcechoir.com"), false);
assert.equal(showsOperatorHome("crowdsourcechoir.com"), false);
assert.equal(showsOperatorHome("preview.example.com"), false);

const cap = addLine([], { slug: "vintage-washed-rope-cap", color: "washed black", size: "One Size", qty: 2 });
assert.equal(cartSubtotal(cap), 6000);
const merged = addLine(cap, { slug: "vintage-washed-rope-cap", color: "washed black", size: "One Size", qty: 1 });
assert.equal(merged.length, 1);
assert.equal(merged[0].qty, 3);
assert.equal(lineKey(merged[0]).includes("washed black"), true);

const inquiry = validateInquiry({
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  planning: "Conference / Event",
  groupSize: "100-250",
  investment: ["$10,000-20,000", "not-a-real-option"],
  about: "Closing ceremony",
});
assert.equal(inquiry.ok, true);
if (inquiry.ok) assert.deepEqual(inquiry.value.investment, ["$10,000-20,000"]);

const bad = validateInquiry({ firstName: "Ada", lastName: "Lovelace", email: "nope" });
assert.equal(bad.ok, false);

const order = validateOrder({
  name: "Ada",
  email: "ada@example.com",
  address: "1 Pike St",
  city: "Seattle",
  lines: [{ slug: "hoodie", color: "white", size: "M", qty: 2 }],
});
assert.equal(order.ok, true);
if (order.ok) assert.equal(order.totalCents, 8000);

const missing = validateOrder({
  name: "Ada",
  email: "ada@example.com",
  address: "1 Pike St",
  city: "Seattle",
  lines: [{ slug: "hoodie", color: "plaid", size: "M", qty: 1 }],
});
assert.equal(missing.ok, false);

assert.equal(decideAccess("/api/choir/inquiry", "POST", new URLSearchParams(), null).kind, "public");
assert.equal(decideAccess("/book", "GET", new URLSearchParams(), null).kind, "public");
assert.equal(decideAccess("/merch/p/hoodie", "GET", new URLSearchParams(), null).kind, "public");

console.log("choir site checks ok");
