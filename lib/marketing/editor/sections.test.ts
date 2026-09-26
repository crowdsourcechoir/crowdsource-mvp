// node --experimental-strip-types --import ./scripts/marketing/register-strip-types.mjs lib/marketing/editor/sections.test.ts
import assert from "node:assert/strict";
import { documentToLegacyBlocks } from "../document/migrate";
import { parseEmailDocument } from "../document/schema";
import { documentFromTemplate, newSection } from "./sections";

const statement = newSection("large_statement");
const document = parseEmailDocument({
  schemaVersion: 1,
  designSystemId: "design-1",
  meta: { internalTitle: "Draft" },
  personalization: { missingTokenBehavior: "fallback", fallbacks: { first_name: "friend" } },
  sections: [statement, newSection("footer")],
});
assert.equal(document.sections[0]?.type, "large_statement");
assert.equal(documentToLegacyBlocks(document).some((block) => block.id === statement.id), false);

const applied = documentFromTemplate(document, "design-2", "Spring");
assert.equal(applied.designSystemId, "design-2");
assert.equal(applied.meta.internalTitle, "Spring");
assert.equal(applied.sections.length, document.sections.length);
assert.notEqual(applied.sections[0]?.id, document.sections[0]?.id);

console.log("email section tests ok");
