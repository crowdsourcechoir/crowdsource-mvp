// node --experimental-strip-types --import ./scripts/marketing/register-strip-types.mjs lib/marketing/assets/policy.test.ts
import assert from "node:assert/strict";
import { emailAssetExtension, isLibraryAssetPath, newEmailAssetPath, EMAIL_ASSET_MAX_BYTES } from "./policy";

assert.equal(emailAssetExtension("image/png"), "png");
assert.equal(emailAssetExtension("image/svg+xml"), null);
assert.equal(EMAIL_ASSET_MAX_BYTES, 5 * 1024 * 1024);

const path = newEmailAssetPath("jpg");
assert.equal(isLibraryAssetPath(path), true);
assert.equal(isLibraryAssetPath("../library/a-b.jpg"), false);
assert.equal(isLibraryAssetPath("library/a-b.svg"), false);

console.log("email asset policy tests ok");
