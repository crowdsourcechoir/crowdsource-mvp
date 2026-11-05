import assert from "node:assert/strict";
import { parseEmailList } from "./email-list";

const parsed = parseEmailList(`Email Address,First Name,City
Ada <ada@example.com>,Ada,Spokane
ada@example.com,Ada,Spokane
grace@example.com,Grace,Boise
not-an-email,Nope,
"bob@example.com",Bob,Seattle
`);

assert.deepEqual(parsed.emails, ["ada@example.com", "grace@example.com", "bob@example.com"]);
assert.equal(parsed.duplicateRows, 1);
assert.equal(parsed.invalidRows, 0);

const plain = parseEmailList("one@example.com\none@example.com\n");
assert.deepEqual(plain.emails, ["one@example.com"]);
assert.equal(plain.duplicateRows, 1);

console.log("email list parser ok");
