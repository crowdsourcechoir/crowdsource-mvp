import assert from "node:assert/strict";
import {
  isCompletionButtonVisible,
  normalizeSongGardenConfig,
  resolveCompletionButtonUrl,
} from "./config";

assert.equal(isCompletionButtonVisible(undefined), true);
assert.equal(isCompletionButtonVisible({ showCompletionButton: false } as never), false);
assert.equal(isCompletionButtonVisible({ showCompletionButton: true } as never), true);

assert.equal(resolveCompletionButtonUrl(undefined), null);
assert.equal(resolveCompletionButtonUrl({ completionButtonUrl: "  " } as never), null);
assert.equal(
  resolveCompletionButtonUrl({ completionButtonUrl: "https://example.com/join" } as never),
  "https://example.com/join"
);
assert.equal(
  resolveCompletionButtonUrl({ completionButtonUrl: "crowdsourcechoir.com/book" } as never),
  "https://crowdsourcechoir.com/book"
);
assert.equal(
  resolveCompletionButtonUrl({ completionButtonUrl: "javascript:alert(1)" } as never),
  null
);

const normalized = normalizeSongGardenConfig({
  completionButtonText: "Join us",
  completionButtonUrl: "https://example.com/r",
  showCompletionButton: true,
});
assert.equal(normalized.completionButtonText, "Join us");
assert.equal(normalized.completionButtonUrl, "https://example.com/r");
assert.equal(normalized.showCompletionButton, true);

console.log("completion-button-url.test.ts: ok");
